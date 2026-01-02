import { PaymentIntent, AgentDecision } from '@cronos-x402/shared-types';
import { FastifyInstance } from 'fastify';
import { getPriceService, PriceService } from '../services/price-service';

export class Agent {
  // Use real price API (set to false for MVP with mock prices)
  private useRealPriceApi = process.env.USE_REAL_PRICE_API === 'true';

  // Price service for Crypto.com MCP + CoinGecko fallback
  private priceService: PriceService | null = null;

  constructor(private logger: FastifyInstance['log']) {
    // Try to get price service if initialized
    try {
      this.priceService = getPriceService();
    } catch {
      this.logger.warn('[Agent] PriceService not initialized, using mock prices');
    }
  }

  async evaluate(intent: PaymentIntent): Promise<AgentDecision> {
    this.logger.info({ intentId: intent.intentId }, `[Agent] Evaluating intent: ${intent.intentId}`);
    this.logger.info({ condition: intent.condition }, `[Agent] Condition: ${intent.condition.type} = ${intent.condition.value}`);

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
      this.logger.warn({ targetPrice: intent.condition.value }, '[Agent] Invalid price threshold');
      return {
        decision: 'SKIP',
        reason: `Invalid price threshold: ${intent.condition.value}`,
      };
    }

    const currentPrice = await this.fetchCurrentPrice('CRO', 'USD');

    this.logger.info({ currentPrice, targetPrice }, '[Agent] Price comparison');

    if (currentPrice < targetPrice) {
      this.logger.info({ currentPrice, targetPrice }, '[Agent] Price below threshold - EXECUTE');
      return {
        decision: 'EXECUTE',
        reason: `Price ${currentPrice} is below threshold ${targetPrice}`,
      };
    }

    this.logger.info({ currentPrice, targetPrice }, '[Agent] Price above threshold - SKIP');
    return {
      decision: 'SKIP',
      reason: `Price ${currentPrice} is above or equal to threshold ${targetPrice}`,
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
    return 0.1; // Mock CRO/USD price for MVP
  }
}

