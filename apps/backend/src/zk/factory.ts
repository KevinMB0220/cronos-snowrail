/**
 * ZK Services Factory
 * Creates and configures ZK providers based on environment
 */

import { FastifyInstance } from 'fastify';
import { IVerifyProvider } from './interfaces/IVerifyProvider';
import { IZKProofProvider } from './interfaces/IZKProofProvider';
import { CronosVerifyProvider } from './providers/CronosVerifyProvider';
import { MockVerifyProvider } from './providers/MockVerifyProvider';
import { NoirProvider } from './providers/NoirProvider';
import { MockZKProvider } from './providers/MockZKProvider';
import { initializeVerifyService } from '../services/verify-service';
import { initializeZKProofService } from '../services/zkproof-service';

export type VerifyProviderType = 'cronos-verify' | 'mock';
export type ZKProviderType = 'noir' | 'mock';

/**
 * Create a verification provider by type
 */
export function createVerifyProvider(
  type: VerifyProviderType,
  config?: { initialVerified?: string[] }
): IVerifyProvider {
  switch (type) {
    case 'cronos-verify':
      return new CronosVerifyProvider();
    case 'mock':
      return new MockVerifyProvider(config?.initialVerified);
    default:
      throw new Error(`Unknown verify provider: ${type}`);
  }
}

/**
 * Create a ZK proof provider by type
 */
export function createZKProvider(type: ZKProviderType): IZKProofProvider {
  switch (type) {
    case 'noir':
      return new NoirProvider();
    case 'mock':
      return new MockZKProvider();
    default:
      throw new Error(`Unknown ZK provider: ${type}`);
  }
}

/**
 * Initialize all ZK services based on environment config
 */
export function initializeZKServices(server: FastifyInstance): void {
  // Read provider types from environment
  const verifyType = (process.env.VERIFY_PROVIDER || 'mock') as VerifyProviderType;
  const zkType = (process.env.ZK_PROVIDER || 'mock') as ZKProviderType;

  // Feature flags
  const verifyEnabled = process.env.REQUIRE_VERIFICATION === 'true';
  const zkEnabled = process.env.USE_ZK_PROOFS === 'true';

  server.log.info({
    verifyProvider: verifyType,
    zkProvider: zkType,
    verifyEnabled,
    zkEnabled,
  }, '[ZK] Initializing services');

  // Create providers
  const verifyProvider = createVerifyProvider(verifyType);
  const zkProvider = createZKProvider(zkType);

  // Initialize services
  initializeVerifyService(server, verifyProvider);
  initializeZKProofService(server, zkProvider);

  server.log.info('[ZK] Services initialized successfully');
}

// Re-export interfaces and providers for external use
export type { IVerifyProvider, VerificationResult } from './interfaces/IVerifyProvider';
export type { IZKProofProvider, ZKProof, ZKProofInput, VerifyProofResult } from './interfaces/IZKProofProvider';
export { MockVerifyProvider } from './providers/MockVerifyProvider';
export { MockZKProvider } from './providers/MockZKProvider';
export { CronosVerifyProvider } from './providers/CronosVerifyProvider';
export { NoirProvider } from './providers/NoirProvider';
