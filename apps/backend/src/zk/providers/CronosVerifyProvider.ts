/**
 * Cronos Verify Provider
 *
 * LEGO-swappable implementation for Cronos Verify identity verification.
 * Provides privacy-preserving wallet verification for the Cronos ecosystem.
 *
 * Features:
 * - Caches verification results (5 min TTL)
 * - Graceful fallback on API errors
 * - Health check endpoint
 */

import { IVerifyProvider, VerificationResult } from '../interfaces/IVerifyProvider';

interface CacheEntry {
  result: VerificationResult;
  expires: number;
}

export interface CronosVerifyConfig {
  apiEndpoint: string;
  apiKey?: string;
  cacheTTL?: number;
  timeout?: number;
}

export class CronosVerifyProvider implements IVerifyProvider {
  readonly name = 'cronos-verify';

  private cache = new Map<string, CacheEntry>();
  private readonly cacheTTL: number;
  private readonly timeout: number;

  constructor(
    private config: CronosVerifyConfig,
    private logger?: { info: Function; warn: Function; error: Function }
  ) {
    this.cacheTTL = config.cacheTTL ?? 300000; // 5 minutes
    this.timeout = config.timeout ?? 5000; // 5 seconds
  }

  async isVerified(address: string): Promise<boolean> {
    const status = await this.getVerificationStatus(address);
    return status.isVerified;
  }

  async getVerificationStatus(address: string): Promise<VerificationResult> {
    const normalizedAddress = address.toLowerCase();

    // Check cache
    const cached = this.cache.get(normalizedAddress);
    if (cached && cached.expires > Date.now()) {
      this.logger?.info({ address: normalizedAddress, cached: true }, '[CronosVerify] Cache hit');
      return cached.result;
    }

    try {
      const result = await this.fetchFromAPI(normalizedAddress);

      // Cache result
      this.cache.set(normalizedAddress, {
        result,
        expires: Date.now() + this.cacheTTL,
      });

      this.logger?.info(
        { address: normalizedAddress, isVerified: result.isVerified },
        '[CronosVerify] Verification fetched'
      );

      return result;
    } catch (error) {
      this.logger?.error(
        { address: normalizedAddress, error: String(error) },
        '[CronosVerify] API error'
      );

      // Return cached result if available (even if expired)
      if (cached) {
        this.logger?.warn('[CronosVerify] Using expired cache due to API error');
        return cached.result;
      }

      // Default to unverified on error
      return {
        isVerified: false,
        metadata: {
          error: 'API unavailable',
          provider: this.name,
        },
      };
    }
  }

  private async fetchFromAPI(address: string): Promise<VerificationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.config.apiEndpoint}/v1/verify/${address}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Cronos-X402-Treasury/1.0',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Cronos Verify API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        verified: boolean;
        level?: string;
        expiresAt?: number;
      };

      return {
        isVerified: data.verified,
        level: data.level as 'basic' | 'advanced' | 'full' | undefined,
        expiresAt: data.expiresAt,
        metadata: {
          provider: this.name,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.config.apiEndpoint}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        return response.ok;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }

  // Clear cache (for testing)
  clearCache(): void {
    this.cache.clear();
  }
}
