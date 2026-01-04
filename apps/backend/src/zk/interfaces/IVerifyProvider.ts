/**
 * Verification Provider Interface - LEGO #1
 *
 * Abstraction for identity/wallet verification services.
 * Implementations can be swapped without changing consumer code.
 *
 * Current implementations:
 * - CronosVerifyProvider: Cronos Verify integration
 * - MockVerifyProvider: Testing/development
 */

export interface VerificationResult {
  /** Whether the address is verified */
  isVerified: boolean;
  /** Verification level if applicable */
  level?: 'basic' | 'advanced' | 'full';
  /** When verification expires (unix timestamp) */
  expiresAt?: number;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface IVerifyProvider {
  /** Provider identifier */
  readonly name: string;

  /**
   * Check if a wallet address is verified
   * @param address - Ethereum address to check
   * @returns true if verified, false otherwise
   */
  isVerified(address: string): Promise<boolean>;

  /**
   * Get detailed verification status
   * @param address - Ethereum address to check
   * @returns Full verification result with metadata
   */
  getVerificationStatus(address: string): Promise<VerificationResult>;

  /**
   * Health check for the provider
   * @returns true if provider is operational
   */
  healthCheck(): Promise<boolean>;
}
