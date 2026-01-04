/**
 * ZK Services Module
 *
 * Entry point for ZK integration with LEGO-swappable providers.
 * Initializes verification and ZK proof services.
 */

import { FastifyInstance } from 'fastify';
import { IVerifyProvider } from './interfaces/IVerifyProvider';
import { IZKProofProvider } from './interfaces/IZKProofProvider';
import {
  createVerifyProvider,
  createZKProvider,
  buildConfigFromEnv,
  ZKFactoryConfig,
} from './factory';

// Singleton instances
let verifyProvider: IVerifyProvider | null = null;
let zkProvider: IZKProofProvider | null = null;
let initialized = false;

/**
 * Initialize ZK services with server logger
 */
export function initializeZKServices(server: FastifyInstance): void {
  if (initialized) {
    server.log.warn('[ZK] Services already initialized');
    return;
  }

  const config = buildConfigFromEnv();

  verifyProvider = createVerifyProvider(config, server.log);
  zkProvider = createZKProvider(config, server.log);

  initialized = true;

  server.log.info(
    {
      verifyProvider: verifyProvider.name,
      zkProvider: zkProvider.name,
      zkCircuits: zkProvider.supportedCircuits,
    },
    '[ZK] Services initialized'
  );
}

/**
 * Initialize with custom configuration (for testing)
 */
export function initializeZKServicesWithConfig(
  config: ZKFactoryConfig,
  logger?: any
): void {
  verifyProvider = createVerifyProvider(config, logger);
  zkProvider = createZKProvider(config, logger);
  initialized = true;
}

/**
 * Get verification provider singleton
 */
export function getVerifyProvider(): IVerifyProvider {
  if (!verifyProvider) {
    throw new Error('VerifyProvider not initialized. Call initializeZKServices first.');
  }
  return verifyProvider;
}

/**
 * Get ZK proof provider singleton
 */
export function getZKProvider(): IZKProofProvider {
  if (!zkProvider) {
    throw new Error('ZKProvider not initialized. Call initializeZKServices first.');
  }
  return zkProvider;
}

/**
 * Check if ZK services are initialized
 */
export function isZKInitialized(): boolean {
  return initialized;
}

/**
 * Get ZK services status for health checks
 */
export async function getZKStatus(): Promise<{
  initialized: boolean;
  verifyProvider: { name: string; healthy: boolean } | null;
  zkProvider: { name: string; healthy: boolean; circuits: string[] } | null;
}> {
  if (!initialized) {
    return { initialized: false, verifyProvider: null, zkProvider: null };
  }

  const [verifyHealthy, zkHealthy] = await Promise.all([
    verifyProvider?.healthCheck() ?? false,
    zkProvider?.healthCheck() ?? false,
  ]);

  return {
    initialized: true,
    verifyProvider: verifyProvider
      ? { name: verifyProvider.name, healthy: verifyHealthy }
      : null,
    zkProvider: zkProvider
      ? { name: zkProvider.name, healthy: zkHealthy, circuits: zkProvider.supportedCircuits }
      : null,
  };
}

// Re-export interfaces and types
export * from './interfaces/IVerifyProvider';
export * from './interfaces/IZKProofProvider';
export * from './factory';
