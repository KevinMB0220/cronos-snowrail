export type IntentStatus = 'pending' | 'executed' | 'failed';

export type ConditionType = 'manual' | 'price-below';

export interface PaymentCondition {
  type: ConditionType;
  value: string;
}

export interface PaymentIntent {
  intentId: string;
  amount: string;
  currency: string;
  recipient: string;
  condition: PaymentCondition;
  status: IntentStatus;
  createdAt: string;
  txHash?: string;
}

export interface AgentDecision {
  decision: 'EXECUTE' | 'SKIP';
  reason: string;
}

// API Response Standard
export interface ApiResponse<T = any> {
  status: 'success' | 'warning' | 'error';
  code: string;
  message: string;
  data?: T;
  details?: any;
}

