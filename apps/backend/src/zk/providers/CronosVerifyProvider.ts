/**
 * Cronos Verify Provider
 * LEGO #3: Privacy-preserving identity verification via Cronos Verify API
 */

import { IVerifyProvider, VerificationResult } from '../interfaces/IVerifyProvider';

interface CronosVerifyResponse {
  verified: boolean;
  verifiedAt?: number;
  verificationLevel?: string;
  expiresAt?: number;
}

export class CronosVerifyProvider implements IVerifyProvider {
  readonly name = 'cronos-verify';

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor() {
    this.apiUrl = process.env.CRONOS_VERIFY_API_URL || 'https://verify.cronos.org/api/v1';
    this.apiKey = process.env.CRONOS_VERIFY_API_KEY || '';
    this.timeout = 5000; // 5 seconds
  }

  async isVerified(address: string): Promise<VerificationResult> {
    const normalized = address.toLowerCase();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(
          `${this.apiUrl}/wallets/${normalized}/status`,
          {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Cronos-X402-Treasury/1.0',
            },
          }
        );

        if (!response.ok) {
          // Don't throw on 404 - just means not verified
          if (response.status === 404) {
            return {
              isVerified: false,
              source: this.name,
            };
          }
          throw new Error(`Cronos Verify API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as CronosVerifyResponse;

        return {
          isVerified: data.verified,
          verifiedAt: data.verifiedAt,
          expiresAt: data.expiresAt,
          level: data.verificationLevel,
          source: this.name,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // REQ-V4: Verification failure MUST NOT block execution
      // Return unverified on error, log but don't throw
      console.error('[CronosVerifyProvider] API error:', error instanceof Error ? error.message : error);

      return {
        isVerified: false,
        source: this.name,
      };
    }
  }

  async batchVerify(addresses: string[]): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();

    // Process in parallel with concurrency limit
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(addr => this.isVerified(addr))
      );

      batch.forEach((addr, idx) => {
        results.set(addr.toLowerCase(), batchResults[idx]);
      });
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.apiUrl}/health`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Cronos-X402-Treasury/1.0',
          },
        });
        return response.ok;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }
}
