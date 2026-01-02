/**
 * Verification Service
 * Manages identity verification with pluggable providers
 */

import { FastifyInstance } from 'fastify';
import { IVerifyProvider, VerificationResult } from '../zk/interfaces/IVerifyProvider';

// Singleton instance
let verifyServiceInstance: VerifyService | null = null;

export function initializeVerifyService(
  server: FastifyInstance,
  provider: IVerifyProvider
): void {
  verifyServiceInstance = new VerifyService(server.log, provider);
  server.log.info(`[VerifyService] Initialized with provider: ${provider.name}`);
}

export function getVerifyService(): VerifyService {
  if (!verifyServiceInstance) {
    throw new Error('VerifyService not initialized. Call initializeVerifyService first.');
  }
  return verifyServiceInstance;
}

export class VerifyService {
  // Cache with TTL (REQ-V1: <= 5 minutes)
  private cache = new Map<string, { result: VerificationResult; expires: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    private logger: FastifyInstance['log'],
    private provider: IVerifyProvider
  ) {}

  /**
   * Check if a wallet address is verified
   */
  async isVerified(address: string): Promise<VerificationResult> {
    const normalizedAddress = address.toLowerCase();

    // Check cache
    const cached = this.cache.get(normalizedAddress);
    if (cached && cached.expires > Date.now()) {
      this.logger.debug({ address, source: 'cache' }, '[VerifyService] Cache hit');
      return cached.result;
    }

    // Fetch from provider
    const result = await this.provider.isVerified(normalizedAddress);

    // Cache result (REQ-V2: validate before caching)
    if (result && typeof result.isVerified === 'boolean') {
      this.cache.set(normalizedAddress, {
        result,
        expires: Date.now() + this.CACHE_TTL,
      });
    }

    this.logger.info(
      { address, isVerified: result.isVerified, provider: this.provider.name },
      '[VerifyService] Verification checked'
    );

    return result;
  }

  /**
   * Batch verify multiple addresses
   */
  async batchVerify(addresses: string[]): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();
    const uncached: string[] = [];

    // Check cache first
    for (const address of addresses) {
      const normalized = address.toLowerCase();
      const cached = this.cache.get(normalized);

      if (cached && cached.expires > Date.now()) {
        results.set(normalized, cached.result);
      } else {
        uncached.push(normalized);
      }
    }

    // Fetch uncached from provider
    if (uncached.length > 0) {
      if (this.provider.batchVerify) {
        const providerResults = await this.provider.batchVerify(uncached);
        providerResults.forEach((result, address) => {
          results.set(address, result);
          this.cache.set(address, {
            result,
            expires: Date.now() + this.CACHE_TTL,
          });
        });
      } else {
        // Fallback to individual calls
        for (const address of uncached) {
          const result = await this.provider.isVerified(address);
          results.set(address, result);
          this.cache.set(address, {
            result,
            expires: Date.now() + this.CACHE_TTL,
          });
        }
      }
    }

    return results;
  }

  /**
   * Swap provider at runtime (LEGO swap)
   * REQ-V3: Provider swap MUST emit audit event
   */
  setProvider(newProvider: IVerifyProvider): void {
    const oldProvider = this.provider.name;
    this.provider = newProvider;
    this.cache.clear();

    this.logger.info(
      { oldProvider, newProvider: newProvider.name },
      '[VerifyService] Provider swapped'
    );
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('[VerifyService] Cache cleared');
  }
}
