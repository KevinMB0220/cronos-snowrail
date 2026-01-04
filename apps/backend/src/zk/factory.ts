/**
 * ZK Provider Factory
 *
 * Creates LEGO-swappable providers based on configuration.
 * Allows runtime switching between implementations.
 */

import { IVerifyProvider } from './interfaces/IVerifyProvider';
import { IZKProofProvider } from './interfaces/IZKProofProvider';
import { CronosVerifyProvider, CronosVerifyConfig } from './providers/CronosVerifyProvider';
import { MockVerifyProvider } from './providers/MockVerifyProvider';
import { NoirProvider, NoirProviderConfig } from './providers/NoirProvider';
import { MockZKProvider } from './providers/MockZKProvider';

export type VerifyProviderType = 'cronos-verify' | 'mock';
export type ZKProviderType = 'noir' | 'mock';

export interface ZKFactoryConfig {
  verifyProvider: VerifyProviderType;
  zkProvider: ZKProviderType;
  cronosVerify?: CronosVerifyConfig;
  noir?: NoirProviderConfig;
  mock?: {
    verifyAll?: boolean;
    initialVerified?: string[];
  };
}

export interface ZKLogger {
  info: Function;
  warn: Function;
  error: Function;
  debug: Function;
}

/**
 * Create a verification provider based on configuration
 */
export function createVerifyProvider(
  config: ZKFactoryConfig,
  logger?: ZKLogger
): IVerifyProvider {
  switch (config.verifyProvider) {
    case 'cronos-verify':
      if (!config.cronosVerify) {
        throw new Error('Cronos Verify config required when using cronos-verify provider');
      }
      return new CronosVerifyProvider(config.cronosVerify, logger);

    case 'mock':
    default:
      return new MockVerifyProvider(config.mock);
  }
}

/**
 * Create a ZK proof provider based on configuration
 */
export function createZKProvider(
  config: ZKFactoryConfig,
  logger?: ZKLogger
): IZKProofProvider {
  switch (config.zkProvider) {
    case 'noir':
      if (!config.noir) {
        throw new Error('Noir config required when using noir provider');
      }
      return new NoirProvider(config.noir, logger);

    case 'mock':
    default:
      return new MockZKProvider();
  }
}

/**
 * Build configuration from environment variables
 */
export function buildConfigFromEnv(): ZKFactoryConfig {
  return {
    verifyProvider: (process.env.VERIFY_PROVIDER as VerifyProviderType) || 'mock',
    zkProvider: (process.env.ZK_PROVIDER as ZKProviderType) || 'mock',
    cronosVerify: process.env.CRONOS_VERIFY_ENDPOINT
      ? {
          apiEndpoint: process.env.CRONOS_VERIFY_ENDPOINT,
          apiKey: process.env.CRONOS_VERIFY_API_KEY,
          cacheTTL: parseInt(process.env.CRONOS_VERIFY_CACHE_TTL || '300000', 10),
        }
      : undefined,
    noir: {
      circuitsPath: process.env.NOIR_CIRCUITS_PATH || './circuits',
      verifierContracts: {
        price_condition: process.env.PRICE_CONDITION_VERIFIER || '',
        'price-below': process.env.PRICE_BELOW_VERIFIER || '',
        'price-above': process.env.PRICE_ABOVE_VERIFIER || '',
      },
    },
    mock: {
      verifyAll: process.env.MOCK_VERIFY_ALL === 'true',
    },
  };
}
