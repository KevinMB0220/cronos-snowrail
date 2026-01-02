import { PaymentIntent, AgentDecision } from '@cronos-x402/shared-types';
import { FastifyInstance } from 'fastify';
import { getPriceService, PriceService } from '../services/price-service';
import { getZKProofService, ZKProofService } from '../services/zkproof-service';
import { ZKProof } from '../zk/interfaces/IZKProofProvider';

export interface AgentDecisionWithProof extends AgentDecision {
  zkProof?: ZKProof;
}

export class Agent {
  // Use real price API (set to false for MVP with mock prices)
  private useRealPriceApi = process.env.USE_REAL_PRICE_API === 'true';

  // Use ZK proofs for privacy
  private useZKProofs = process.env.USE_ZK_PROOFS === 'true';

  // Price service for Crypto.com MCP + CoinGecko fallback
  private priceService: PriceService | null = null;

  // ZK Proof service for privacy
  private zkService: ZKProofService | null = null;

  constructor(private logger: FastifyInstance['log']) {
    // Try to get price service if initialized
    try {
      this.priceService = getPriceService();
    } catch {
      this.logger.warn('[Agent] PriceService not initialized, using mock prices');
    }

    // Try to get ZK service if initialized
    try {
      this.zkService = getZKProofService();
    } catch {
      this.logger.warn('[Agent] ZKProofService not initialized, ZK proofs disabled');
    }
  }

  async evaluate(intent: PaymentIntent): Promise<AgentDecisionWithProof> {
    this.logger.info({ intentId: intent.intentId }, `[Agent] Evaluating intent: ${intent.intentId}`);
    // NOTE: Never log the condition value (threshold) when ZK is enabled
    this.logger.info(
      { conditionType: intent.condition.type, zkEnabled: this.useZKProofs },
      `[Agent] Condition type: ${intent.condition.type}`
    );

    try {
      switch (intent.condition.type) {
        case 'manual':
          return this.evaluateManual();
        case 'price-below':
          return await this.evaluatePriceBelow(intent);
        default:
          return {
            decision: 'SKIP',
            reason: `Unknown condition type: ${intent.condition.type}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error }, `[Agent] Evaluation error: ${errorMessage}`);
      return {
        decision: 'SKIP',
        reason: `Evaluation error: ${errorMessage}`,
      };
    }
  }

  private evaluateManual(): AgentDecisionWithProof {
    this.logger.info('[Agent] Manual condition - always execute');
    return {
      decision: 'EXECUTE',
      reason: 'Manual condition - always execute',
    };
  }

  private async evaluatePriceBelow(intent: PaymentIntent): Promise<AgentDecisionWithProof> {
    const targetPrice = parseFloat(intent.condition.value);

    if (isNaN(targetPrice) || targetPrice <= 0) {
      // Don't log the actual value for privacy
      this.logger.warn('[Agent] Invalid price threshold provided');
      return {
        decision: 'SKIP',
        reason: 'Invalid price threshold',
      };
    }

    const currentPrice = await this.fetchCurrentPrice('CRO', 'USD');
    const conditionMet = currentPrice < targetPrice;

    // Generate ZK proof if enabled (threshold stays private)
    let zkProof: ZKProof | undefined;
    if (this.useZKProofs && this.zkService) {
      try {
        this.logger.info(
          { intentId: intent.intentId, currentPrice },
          '[Agent] Generating ZK proof for price condition (threshold hidden)'
        );

        zkProof = await this.zkService.generatePriceConditionProof(
          currentPrice,
          targetPrice, // This is the PRIVATE input - never logged
          intent.intentId
        );

        this.logger.info(
          { intentId: intent.intentId, proofGenerated: true },
          '[Agent] ZK proof generated successfully'
        );
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          '[Agent] ZK proof generation failed, continuing without proof'
        );
      }
    }

    // Log without revealing threshold
    this.logger.info(
      { currentPrice, conditionMet, hasZKProof: !!zkProof },
      '[Agent] Price evaluation complete (threshold hidden)'
    );

    if (conditionMet) {
      return {
        decision: 'EXECUTE',
        reason: zkProof
          ? 'Price condition met (verified with ZK proof - threshold private)'
          : `Price ${currentPrice} meets condition`,
        zkProof,
      };
    }

    return {
      decision: 'SKIP',
      reason: zkProof
        ? 'Price condition not met (verified with ZK proof - threshold private)'
        : `Price ${currentPrice} does not meet condition`,
      zkProof,
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
