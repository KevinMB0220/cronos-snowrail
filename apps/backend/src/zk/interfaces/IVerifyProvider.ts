/**
 * Verification Provider Interface
 * LEGO Module: Swappable identity verification providers
 */

export interface VerificationResult {
  isVerified: boolean;
  verifiedAt?: number;      // Unix timestamp
  expiresAt?: number;       // Cache expiration
  level?: string;           // 'basic' | 'kyc' | 'accredited'
  source: string;           // Provider name
  proof?: string;           // Optional ZK proof
}

export interface IVerifyProvider {
  readonly name: string;

  /**
   * Check if a wallet address is verified
   */
  isVerified(address: string): Promise<VerificationResult>;

  /**
   * Batch verification for multiple addresses
   */
  batchVerify?(addresses: string[]): Promise<Map<string, VerificationResult>>;

  /**
   * Health check for the provider
   */
  healthCheck(): Promise<boolean>;
}
