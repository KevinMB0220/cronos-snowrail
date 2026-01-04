/**
 * Mock Verification Provider
 *
 * LEGO-swappable implementation for testing and development.
 * All addresses are verified by default, or use whitelist mode.
 */

import { IVerifyProvider, VerificationResult } from '../interfaces/IVerifyProvider';

export class MockVerifyProvider implements IVerifyProvider {
  readonly name = 'mock-verify';

  private verifiedAddresses = new Set<string>();
  private verifyAll: boolean;

  constructor(options?: { verifyAll?: boolean; initialVerified?: string[] }) {
    this.verifyAll = options?.verifyAll ?? true;
    if (options?.initialVerified) {
      options.initialVerified.forEach((addr) => this.verifiedAddresses.add(addr.toLowerCase()));
    }
  }

  async isVerified(address: string): Promise<boolean> {
    if (this.verifyAll) {
      return true;
    }
    return this.verifiedAddresses.has(address.toLowerCase());
  }

  async getVerificationStatus(address: string): Promise<VerificationResult> {
    const isVerified = await this.isVerified(address);
    return {
      isVerified,
      level: isVerified ? 'basic' : undefined,
      metadata: {
        provider: this.name,
        mode: this.verifyAll ? 'verify-all' : 'whitelist',
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // Test helpers
  addVerified(address: string): void {
    this.verifiedAddresses.add(address.toLowerCase());
  }

  removeVerified(address: string): void {
    this.verifiedAddresses.delete(address.toLowerCase());
  }

  setVerifyAll(value: boolean): void {
    this.verifyAll = value;
  }
}
