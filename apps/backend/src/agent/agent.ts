import { PaymentIntent, AgentDecision } from '@cronos-x402/shared-types';
import { FastifyInstance } from 'fastify';
import { getPriceService, PriceService } from '../services/price-service';
import {
  isZKInitialized,
  getVerifyProvider,
  getZKProvider,
  IVerifyProvider,
  IZKProofProvider,
  ZKProof,
} from '../zk';
import { generateIntentHash } from '../utils/crypto';

// Extended decision with optional ZK proof
export interface AgentDecisionWithZK extends AgentDecision {
  zkProof?: ZKProof;
  verificationStatus?: {
    checked: boolean;
    verified: boolean;
  };
}

export class Agent {
  // Use real price API (set to false for MVP with mock prices)
  private useRealPriceApi = process.env.USE_REAL_PRICE_API === 'true';

  // Feature flags for ZK integration
  private requireVerification = process.env.REQUIRE_VERIFICATION === 'true';
  private useZKProofs = process.env.USE_ZK_PROOFS === 'true';

  // Price service for Crypto.com MCP + CoinGecko fallback
  private priceService: PriceService | null = null;

  // ZK providers (LEGO modules)
  private verifyProvider: IVerifyProvider | null = null;
  private zkProvider: IZKProofProvider | null = null;

  constructor(private logger: FastifyInstance['log']) {
    // Try to get price service if initialized
    try {
      this.priceService = getPriceService();
    } catch {
      this.logger.warn('[Agent] PriceService not initialized, using mock prices');
    }

    // Try to get ZK providers if initialized
    if (isZKInitialized()) {
      try {
        this.verifyProvider = getVerifyProvider();
        this.zkProvider = getZKProvider();
        this.logger.info(
          { verify: this.verifyProvider.name, zk: this.zkProvider.name },
          '[Agent] ZK providers initialized'
        );
      } catch {
        this.logger.warn('[Agent] ZK providers not available');
      }
    }
  }

  async evaluate(intent: PaymentIntent): Promise<AgentDecisionWithZK> {
    this.logger.info({ intentId: intent.intentId }, `[Agent] Evaluating intent: ${intent.intentId}`);
    this.logger.info(
      { conditionType: intent.condition.type },
      `[Agent] Condition type: ${intent.condition.type}`
    );

    try {
      // Step 1: Check recipient verification (if enabled)
      const verificationStatus = await this.checkVerification(intent.recipient);
      if (this.requireVerification && !verificationStatus.verified) {
        return {
          decision: 'SKIP',
          reason: 'Recipient wallet not verified',
          verificationStatus,
        };
      }

      // Step 2: Evaluate condition
      let baseDecision: AgentDecision;
      switch (intent.condition.type) {
        case 'manual':
          baseDecision = this.evaluateManual();
          break;
        case 'price-below':
          baseDecision = await this.evaluatePriceBelow(intent);
          break;
        default:
          return {
            decision: 'SKIP',
            reason: `Unknown condition type: ${intent.condition.type}`,
            verificationStatus,
          };
      }

      // Step 3: Generate ZK proof if enabled and condition met
      let zkProof: ZKProof | undefined;
      if (
        this.useZKProofs &&
        baseDecision.decision === 'EXECUTE' &&
        intent.condition.type === 'price-below' &&
        this.zkProvider
      ) {
        zkProof = await this.generateZKProof(intent);
      }

      return {
        ...baseDecision,
        zkProof,
        verificationStatus,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error }, `[Agent] Evaluation error: ${errorMessage}`);
      return {
        decision: 'SKIP',
        reason: `Evaluation error: ${errorMessage}`,
      };
    }
  }

  private async checkVerification(
    address: string
  ): Promise<{ checked: boolean; verified: boolean }> {
    if (!this.verifyProvider) {
      return { checked: false, verified: true }; // Skip verification if not configured
    }

    try {
      const isVerified = await this.verifyProvider.isVerified(address);
      this.logger.info(
        { address, isVerified, provider: this.verifyProvider.name },
        '[Agent] Verification check complete'
      );
      return { checked: true, verified: isVerified };
    } catch (error) {
      this.logger.warn({ address, error: String(error) }, '[Agent] Verification check failed');
      return { checked: true, verified: false };
    }
  }

  private async generateZKProof(intent: PaymentIntent): Promise<ZKProof | undefined> {
    if (!this.zkProvider) return undefined;

    try {
      const currentPrice = await this.fetchCurrentPrice('CRO', 'USD');
      const threshold = parseFloat(intent.condition.value);
      const chainId = parseInt(process.env.CHAIN_ID || '338', 10);

      // Generate intent hash for proof binding
      const intentHash = generateIntentHash(
        intent.intentId,
        intent.amount,
        intent.recipient,
        chainId,
        0
      );

      const proof = await this.zkProvider.generateProof({
        type: 'price-below',
        privateInputs: {
          threshold: threshold,
        },
        publicInputs: {
          current_price: currentPrice,
          intent_hash: intentHash,
          is_less_than: 1,
        },
      });

      this.logger.info(
        { intentId: intent.intentId, circuitId: proof.circuitId },
        '[Agent] ZK proof generated'
      );

      return proof;
    } catch (error) {
      this.logger.error({ error: String(error) }, '[Agent] ZK proof generation failed');
      return undefined;
    }
  }

  private evaluateManual(): AgentDecision {
    this.logger.info('[Agent] Manual condition - always execute');
    return {
      decision: 'EXECUTE',
      reason: 'Manual condition - always execute',
    };
  }

  private async evaluatePriceBelow(intent: PaymentIntent): Promise<AgentDecision> {
    const targetPrice = parseFloat(intent.condition.value);

    if (isNaN(targetPrice) || targetPrice <= 0) {
      this.logger.warn('[Agent] Invalid price threshold provided');
      return {
        decision: 'SKIP',
        reason: 'Invalid price threshold',
      };
    }

    const currentPrice = await this.fetchCurrentPrice('CRO', 'USD');
    const conditionMet = currentPrice < targetPrice;

    this.logger.info(
      { currentPrice, conditionMet },
      '[Agent] Price evaluation complete'
    );

    if (conditionMet) {
      return {
        decision: 'EXECUTE',
        reason: `Price ${currentPrice} meets condition (below threshold)`,
      };
    }

    return {
      decision: 'SKIP',
      reason: `Price ${currentPrice} does not meet condition`,
    };
  }

  private async fetchCurrentPrice(base: string, quote: string): Promise<number> {
    // Use PriceService if available and real API is enabled
    if (this.useRealPriceApi && this.priceService) {
      const result = await this.priceService.fetchPrice(base, quote);
      this.logger.info({ base, quote, price: result.price, source: result.source }, '[Agent] Price fetched via PriceService');
      return result.price;
    }

    // MVP: Return mock price
    this.logger.debug({ base, quote }, '[Agent] Fetching price (MOCK)');
    return 0.08; // Mock CRO/USD price for MVP (below typical thresholds for testing)
  }
}
