import { PaymentIntent, AgentDecision } from '@cronos-x402/shared-types';

export class Agent {
  async evaluate(intent: PaymentIntent): Promise<AgentDecision> {
    console.log(`Evaluating intent: ${intent.intentId}`);
    // TODO: Implement actual decision logic based on intent.condition
    return {
      decision: 'SKIP',
      reason: 'Agent logic not implemented yet'
    };
  }
}

