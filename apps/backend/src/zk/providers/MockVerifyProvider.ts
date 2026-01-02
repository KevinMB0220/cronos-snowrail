/**
 * Mock Verification Provider
 * LEGO #4: For testing and development
 */

import { IVerifyProvider, VerificationResult } from '../interfaces/IVerifyProvider';

export class MockVerifyProvider implements IVerifyProvider {
  readonly name = 'mock-verify';

  // Configurable mock responses
  private verifiedAddresses = new Set<string>();

  constructor(initialVerified: string[] = []) {
    initialVerified.forEach(addr => this.verifiedAddresses.add(addr.toLowerCase()));
  }

  async isVerified(address: string): Promise<VerificationResult> {
    const normalized = address.toLowerCase();
    const isVerified = this.verifiedAddresses.has(normalized);

    return {
      isVerified,
      verifiedAt: isVerified ? Date.now() - 86400000 : undefined, // 1 day ago
      level: isVerified ? 'basic' : undefined,
      source: this.name,
    };
  }

  async batchVerify(addresses: string[]): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();

    for (const address of addresses) {
      results.set(address.toLowerCase(), await this.isVerified(address));
    }

    return results;
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

  clearAll(): void {
    this.verifiedAddresses.clear();
  }

  getVerifiedCount(): number {
    return this.verifiedAddresses.size;
  }
}
