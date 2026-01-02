# ZK Integration Plan - Modular Architecture

> Cronos x402 Agentic Treasury - Zero-Knowledge Integration
> Design: LEGO-like components, independently swappable

## Overview

This plan integrates two ZK capabilities as independent, pluggable modules:

1. **Cronos Verify** - Privacy-preserving identity verification
2. **Noir ZK Proofs** - Private conditions (hide price thresholds)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Fastify)                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        SERVICE LAYER                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │ PriceService    │  │VerifyService    │  │ ZKProofService      │  │   │
│  │  │ (existing)      │  │ (NEW)           │  │ (NEW)               │  │   │
│  │  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │   │
│  │           │                    │                      │              │   │
│  │  ┌────────▼────────┐  ┌────────▼────────┐  ┌─────────▼──────────┐  │   │
│  │  │ IProvider       │  │ IVerifyProvider │  │ IZKProofProvider   │  │   │
│  │  │ interface       │  │ interface       │  │ interface          │  │   │
│  │  └────────┬────────┘  └────────┬────────┘  └─────────┬──────────┘  │   │
│  │           │                    │                      │              │   │
│  │     ┌─────┴─────┐        ┌─────┴─────┐          ┌─────┴─────┐       │   │
│  │     ▼           ▼        ▼           ▼          ▼           ▼       │   │
│  │ ┌───────┐ ┌─────────┐ ┌───────┐ ┌───────┐ ┌─────────┐ ┌─────────┐  │   │
│  │ │Crypto │ │CoinGecko│ │Cronos │ │ Mock  │ │  Noir   │ │  Mock   │  │   │
│  │ │.com   │ │Provider │ │Verify │ │Verify │ │Provider │ │  ZK     │  │   │
│  │ │MCP    │ │         │ │       │ │       │ │         │ │Provider │  │   │
│  │ └───────┘ └─────────┘ └───────┘ └───────┘ └─────────┘ └─────────┘  │   │
│  │  LEGO #1   LEGO #2    LEGO #3   LEGO #4    LEGO #5     LEGO #6     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        CONSUMER LAYER                                 │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │     Agent       │  │  Orchestrator   │  │    MCP Server       │  │   │
│  │  │ (uses ZK proof) │  │(uses Verify)    │  │  (exposes tools)    │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMART CONTRACTS                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Settlement.sol (existing)                         │   │
│  │  + IVerificationChecker (optional modifier)                          │   │
│  │  + NoirVerifier integration (optional)                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │ VerificationRegistry│ │ NoirVerifier.sol │  │ SettlementV2.sol     │   │
│  │ (Cronos Verify)    │  │ (ZK Verifier)    │  │ (upgraded, optional) │   │
│  │      LEGO #7       │  │     LEGO #8      │  │      LEGO #9         │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Module 1: Verification Service (Cronos Verify)

### Interface Definition

```typescript
// apps/backend/src/zk/interfaces/IVerifyProvider.ts

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
```

### Service Implementation

```typescript
// apps/backend/src/services/verify-service.ts

import { FastifyInstance } from 'fastify';
import { IVerifyProvider, VerificationResult } from '../zk/interfaces/IVerifyProvider';

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
    throw new Error('VerifyService not initialized');
  }
  return verifyServiceInstance;
}

export class VerifyService {
  // Cache with TTL
  private cache = new Map<string, { result: VerificationResult; expires: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    private logger: FastifyInstance['log'],
    private provider: IVerifyProvider
  ) {}

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

    // Cache result
    this.cache.set(normalizedAddress, {
      result,
      expires: Date.now() + this.CACHE_TTL,
    });

    this.logger.info(
      { address, isVerified: result.isVerified, provider: this.provider.name },
      '[VerifyService] Verification checked'
    );

    return result;
  }

  /**
   * Swap provider at runtime (LEGO swap)
   */
  setProvider(newProvider: IVerifyProvider): void {
    this.provider = newProvider;
    this.cache.clear();
    this.logger.info(`[VerifyService] Provider swapped to: ${newProvider.name}`);
  }

  getProviderName(): string {
    return this.provider.name;
  }
}
```

### Provider: Cronos Verify

```typescript
// apps/backend/src/zk/providers/CronosVerifyProvider.ts

import { IVerifyProvider, VerificationResult } from '../interfaces/IVerifyProvider';

export class CronosVerifyProvider implements IVerifyProvider {
  readonly name = 'cronos-verify';

  private readonly CRONOS_VERIFY_API = process.env.CRONOS_VERIFY_API_URL
    || 'https://verify.cronos.org/api/v1';
  private readonly API_KEY = process.env.CRONOS_VERIFY_API_KEY;

  async isVerified(address: string): Promise<VerificationResult> {
    try {
      const response = await fetch(
        `${this.CRONOS_VERIFY_API}/wallets/${address}/status`,
        {
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Cronos Verify API error: ${response.status}`);
      }

      const data = await response.json() as CronosVerifyResponse;

      return {
        isVerified: data.verified,
        verifiedAt: data.verifiedAt,
        level: data.verificationLevel,
        source: this.name,
      };
    } catch (error) {
      // Return unverified on error, don't block
      return {
        isVerified: false,
        source: this.name,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.CRONOS_VERIFY_API}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

interface CronosVerifyResponse {
  verified: boolean;
  verifiedAt?: number;
  verificationLevel?: string;
}
```

### Provider: Mock (for testing)

```typescript
// apps/backend/src/zk/providers/MockVerifyProvider.ts

import { IVerifyProvider, VerificationResult } from '../interfaces/IVerifyProvider';

export class MockVerifyProvider implements IVerifyProvider {
  readonly name = 'mock-verify';

  // Configurable mock responses
  private verifiedAddresses = new Set<string>();

  constructor(initialVerified: string[] = []) {
    initialVerified.forEach(addr => this.verifiedAddresses.add(addr.toLowerCase()));
  }

  async isVerified(address: string): Promise<VerificationResult> {
    const isVerified = this.verifiedAddresses.has(address.toLowerCase());
    return {
      isVerified,
      verifiedAt: isVerified ? Date.now() - 86400000 : undefined, // 1 day ago
      level: isVerified ? 'basic' : undefined,
      source: this.name,
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
}
```

---

## Module 2: ZK Proof Service (Noir)

### Interface Definition

```typescript
// apps/backend/src/zk/interfaces/IZKProofProvider.ts

export interface ZKProofInput {
  circuitId: string;          // Which circuit to use
  privateInputs: unknown;     // Secret inputs (never logged)
  publicInputs: unknown;      // Public inputs
}

export interface ZKProof {
  proof: string;              // Hex-encoded proof
  publicSignals: string[];    // Public outputs
  circuitId: string;
  generatedAt: number;
}

export interface VerifyProofResult {
  isValid: boolean;
  verifiedAt: number;
  circuitId: string;
}

export interface IZKProofProvider {
  readonly name: string;

  /**
   * Generate a ZK proof
   */
  generateProof(input: ZKProofInput): Promise<ZKProof>;

  /**
   * Verify a ZK proof (off-chain)
   */
  verifyProof(proof: ZKProof): Promise<VerifyProofResult>;

  /**
   * Get available circuits
   */
  getCircuits(): string[];

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}
```

### Service Implementation

```typescript
// apps/backend/src/services/zkproof-service.ts

import { FastifyInstance } from 'fastify';
import { IZKProofProvider, ZKProofInput, ZKProof, VerifyProofResult } from '../zk/interfaces/IZKProofProvider';

let zkProofServiceInstance: ZKProofService | null = null;

export function initializeZKProofService(
  server: FastifyInstance,
  provider: IZKProofProvider
): void {
  zkProofServiceInstance = new ZKProofService(server.log, provider);
  server.log.info(`[ZKProofService] Initialized with provider: ${provider.name}`);
}

export function getZKProofService(): ZKProofService {
  if (!zkProofServiceInstance) {
    throw new Error('ZKProofService not initialized');
  }
  return zkProofServiceInstance;
}

export class ZKProofService {
  // Proof cache: Map<hash(inputs), ZKProof>
  private proofCache = new Map<string, { proof: ZKProof; expires: number }>();
  private readonly PROOF_CACHE_TTL = 60000; // 1 minute

  constructor(
    private logger: FastifyInstance['log'],
    private provider: IZKProofProvider
  ) {}

  /**
   * Generate proof for price-below condition WITHOUT revealing threshold
   */
  async generatePriceConditionProof(
    currentPrice: number,
    threshold: number,
    intentId: string
  ): Promise<ZKProof> {
    // SECURITY: Never log threshold (private input)
    this.logger.info(
      { intentId, circuit: 'price-condition' },
      '[ZKProofService] Generating price condition proof'
    );

    const input: ZKProofInput = {
      circuitId: 'price-condition',
      privateInputs: {
        threshold: Math.floor(threshold * 1e8), // Convert to integer
      },
      publicInputs: {
        currentPrice: Math.floor(currentPrice * 1e8),
        intentId,
        conditionMet: currentPrice < threshold ? 1 : 0,
      },
    };

    return this.provider.generateProof(input);
  }

  /**
   * Verify a proof off-chain
   */
  async verifyProof(proof: ZKProof): Promise<VerifyProofResult> {
    return this.provider.verifyProof(proof);
  }

  /**
   * Swap provider at runtime (LEGO swap)
   */
  setProvider(newProvider: IZKProofProvider): void {
    this.provider = newProvider;
    this.proofCache.clear();
    this.logger.info(`[ZKProofService] Provider swapped to: ${newProvider.name}`);
  }

  getAvailableCircuits(): string[] {
    return this.provider.getCircuits();
  }
}
```

### Provider: Noir

```typescript
// apps/backend/src/zk/providers/NoirProvider.ts

import { IZKProofProvider, ZKProofInput, ZKProof, VerifyProofResult } from '../interfaces/IZKProofProvider';
// import { Noir } from '@noir-lang/noir_js';
// import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';

export class NoirProvider implements IZKProofProvider {
  readonly name = 'noir';

  private circuits: Map<string, CompiledCircuit> = new Map();

  constructor() {
    // Load compiled circuits
    this.loadCircuits();
  }

  private async loadCircuits(): Promise<void> {
    // Load price-condition circuit
    // const priceCircuit = await import('../circuits/price_condition.json');
    // this.circuits.set('price-condition', priceCircuit);
  }

  async generateProof(input: ZKProofInput): Promise<ZKProof> {
    const circuit = this.circuits.get(input.circuitId);
    if (!circuit) {
      throw new Error(`Circuit not found: ${input.circuitId}`);
    }

    // Initialize Noir with Barretenberg backend
    // const backend = new BarretenbergBackend(circuit);
    // const noir = new Noir(circuit, backend);

    // Generate proof
    // const { proof, publicInputs } = await noir.generateProof({
    //   ...input.privateInputs,
    //   ...input.publicInputs,
    // });

    // Placeholder for now
    return {
      proof: '0x' + 'placeholder',
      publicSignals: [],
      circuitId: input.circuitId,
      generatedAt: Date.now(),
    };
  }

  async verifyProof(proof: ZKProof): Promise<VerifyProofResult> {
    const circuit = this.circuits.get(proof.circuitId);
    if (!circuit) {
      throw new Error(`Circuit not found: ${proof.circuitId}`);
    }

    // const backend = new BarretenbergBackend(circuit);
    // const noir = new Noir(circuit, backend);
    // const isValid = await noir.verifyProof(proof);

    return {
      isValid: true, // Placeholder
      verifiedAt: Date.now(),
      circuitId: proof.circuitId,
    };
  }

  getCircuits(): string[] {
    return Array.from(this.circuits.keys());
  }

  async healthCheck(): Promise<boolean> {
    return this.circuits.size > 0;
  }
}

interface CompiledCircuit {
  // Noir circuit artifact
  bytecode: string;
  abi: unknown;
}
```

### Provider: Mock ZK

```typescript
// apps/backend/src/zk/providers/MockZKProvider.ts

import { IZKProofProvider, ZKProofInput, ZKProof, VerifyProofResult } from '../interfaces/IZKProofProvider';
import { ethers } from 'ethers';

export class MockZKProvider implements IZKProofProvider {
  readonly name = 'mock-zk';

  private availableCircuits = ['price-condition', 'balance-check'];

  async generateProof(input: ZKProofInput): Promise<ZKProof> {
    // Generate deterministic mock proof
    const proofData = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(input.publicInputs))
    );

    return {
      proof: proofData,
      publicSignals: Object.values(input.publicInputs as object).map(String),
      circuitId: input.circuitId,
      generatedAt: Date.now(),
    };
  }

  async verifyProof(proof: ZKProof): Promise<VerifyProofResult> {
    // Mock always returns valid for testing
    return {
      isValid: true,
      verifiedAt: Date.now(),
      circuitId: proof.circuitId,
    };
  }

  getCircuits(): string[] {
    return this.availableCircuits;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

---

## Module 3: Service Factory

```typescript
// apps/backend/src/zk/factory.ts

import { FastifyInstance } from 'fastify';
import { IVerifyProvider } from './interfaces/IVerifyProvider';
import { IZKProofProvider } from './interfaces/IZKProofProvider';
import { CronosVerifyProvider } from './providers/CronosVerifyProvider';
import { MockVerifyProvider } from './providers/MockVerifyProvider';
import { NoirProvider } from './providers/NoirProvider';
import { MockZKProvider } from './providers/MockZKProvider';

export type VerifyProviderType = 'cronos-verify' | 'mock';
export type ZKProviderType = 'noir' | 'mock';

export function createVerifyProvider(
  type: VerifyProviderType,
  config?: unknown
): IVerifyProvider {
  switch (type) {
    case 'cronos-verify':
      return new CronosVerifyProvider();
    case 'mock':
      return new MockVerifyProvider(config as string[] | undefined);
    default:
      throw new Error(`Unknown verify provider: ${type}`);
  }
}

export function createZKProvider(
  type: ZKProviderType,
  config?: unknown
): IZKProofProvider {
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
  const verifyType = (process.env.VERIFY_PROVIDER || 'mock') as VerifyProviderType;
  const zkType = (process.env.ZK_PROVIDER || 'mock') as ZKProviderType;

  const verifyProvider = createVerifyProvider(verifyType);
  const zkProvider = createZKProvider(zkType);

  // Import and initialize services
  // initializeVerifyService(server, verifyProvider);
  // initializeZKProofService(server, zkProvider);

  server.log.info({
    verifyProvider: verifyType,
    zkProvider: zkType,
  }, '[ZK] Services initialized');
}
```

---

## Module 4: Integration Points

### 4.1 Agent Integration (Private Conditions)

```typescript
// apps/backend/src/agent/agent.ts - Modified

import { getZKProofService, ZKProofService } from '../services/zkproof-service';

export class Agent {
  private zkProofService: ZKProofService | null = null;
  private useZKProofs = process.env.USE_ZK_PROOFS === 'true';

  constructor(private logger: FastifyInstance['log']) {
    if (this.useZKProofs) {
      try {
        this.zkProofService = getZKProofService();
      } catch {
        this.logger.warn('[Agent] ZKProofService not available');
      }
    }
  }

  private async evaluatePriceBelow(intent: PaymentIntent): Promise<AgentDecision> {
    const targetPrice = parseFloat(intent.condition.value);
    const currentPrice = await this.fetchCurrentPrice('CRO', 'USD');

    // Generate ZK proof if enabled (hides threshold)
    let proof: ZKProof | undefined;
    if (this.useZKProofs && this.zkProofService) {
      proof = await this.zkProofService.generatePriceConditionProof(
        currentPrice,
        targetPrice,
        intent.intentId
      );
      this.logger.info({ intentId: intent.intentId }, '[Agent] ZK proof generated');
    }

    const conditionMet = currentPrice < targetPrice;

    return {
      decision: conditionMet ? 'EXECUTE' : 'SKIP',
      reason: conditionMet
        ? 'Price condition met (ZK verified)'
        : 'Price condition not met',
      proof: proof?.proof, // Include proof in decision
    };
  }
}
```

### 4.2 Orchestrator Integration (Verification Gate)

```typescript
// apps/backend/src/x402/orchestrator.ts - Modified

import { getVerifyService, VerifyService } from '../services/verify-service';

export class Orchestrator {
  private verifyService: VerifyService | null = null;
  private requireVerification = process.env.REQUIRE_VERIFICATION === 'true';

  constructor(private logger: FastifyInstance['log']) {
    if (this.requireVerification) {
      try {
        this.verifyService = getVerifyService();
      } catch {
        this.logger.warn('[Orchestrator] VerifyService not available');
      }
    }
  }

  async execute(intent: PaymentIntent, decision: AgentDecision): Promise<string | null> {
    // ... existing checks ...

    // VERIFICATION GATE (optional)
    if (this.requireVerification && this.verifyService) {
      const verification = await this.verifyService.isVerified(intent.recipient);

      if (!verification.isVerified) {
        this.logger.warn(
          { intentId: intent.intentId, recipient: intent.recipient },
          '[Orchestrator] Recipient not verified - blocking execution'
        );
        throw new Error('Recipient must be verified via Cronos Verify');
      }

      this.logger.info(
        { intentId: intent.intentId, verificationLevel: verification.level },
        '[Orchestrator] Recipient verification passed'
      );
    }

    // ... continue with existing execution ...
  }
}
```

### 4.3 MCP Tools (New)

```typescript
// apps/backend/src/mcp/tools.ts - Add new tools

export const zkTools = [
  {
    name: 'verify_wallet',
    description: 'Check if a wallet address is verified via Cronos Verify',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Wallet address to verify',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_verification_status',
    description: 'Get detailed verification status for a wallet',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Wallet address',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'generate_condition_proof',
    description: 'Generate a ZK proof for a private condition',
    inputSchema: {
      type: 'object',
      properties: {
        intentId: {
          type: 'string',
          description: 'Payment intent ID',
        },
        conditionType: {
          type: 'string',
          enum: ['price-below'],
          description: 'Type of condition to prove',
        },
      },
      required: ['intentId', 'conditionType'],
    },
  },
];
```

---

## Module 5: Smart Contract Upgrades (Optional)

### 5.1 Verification Registry Interface

```solidity
// contracts/contracts/interfaces/IVerificationRegistry.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerificationRegistry {
    function isVerified(address wallet) external view returns (bool);
    function getVerificationLevel(address wallet) external view returns (uint8);
}
```

### 5.2 Noir Verifier Interface

```solidity
// contracts/contracts/interfaces/INoirVerifier.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INoirVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}
```

### 5.3 Settlement V2 (Optional Upgrade)

```solidity
// contracts/contracts/SettlementV2.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Settlement.sol";
import "./interfaces/IVerificationRegistry.sol";
import "./interfaces/INoirVerifier.sol";

contract SettlementV2 is Settlement {
    // Optional verification registry (can be address(0))
    IVerificationRegistry public verificationRegistry;

    // Optional Noir verifier (can be address(0))
    INoirVerifier public noirVerifier;

    // Feature flags
    bool public requireVerification;
    bool public requireZKProof;

    constructor(
        address _executor,
        address _verificationRegistry,
        address _noirVerifier
    ) Settlement(_executor) {
        verificationRegistry = IVerificationRegistry(_verificationRegistry);
        noirVerifier = INoirVerifier(_noirVerifier);
    }

    /**
     * @notice Execute settlement with optional verification and ZK proof
     */
    function executeSettlementV2(
        bytes32 intentHash,
        address payable recipient,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature,
        bytes calldata zkProof,          // Optional ZK proof
        bytes32[] calldata publicInputs  // Optional public inputs
    ) external {
        // Optional: Check verification
        if (requireVerification && address(verificationRegistry) != address(0)) {
            require(
                verificationRegistry.isVerified(recipient),
                "Recipient not verified"
            );
        }

        // Optional: Verify ZK proof
        if (requireZKProof && address(noirVerifier) != address(0)) {
            require(
                noirVerifier.verify(zkProof, publicInputs),
                "Invalid ZK proof"
            );
        }

        // Call parent execution
        this.executeSettlement(intentHash, recipient, amount, nonce, signature);
    }

    // Admin functions to toggle features
    function setRequireVerification(bool _require) external onlyOwner {
        requireVerification = _require;
    }

    function setRequireZKProof(bool _require) external onlyOwner {
        requireZKProof = _require;
    }

    function setVerificationRegistry(address _registry) external onlyOwner {
        verificationRegistry = IVerificationRegistry(_registry);
    }

    function setNoirVerifier(address _verifier) external onlyOwner {
        noirVerifier = INoirVerifier(_verifier);
    }
}
```

---

## Module 6: Configuration

### Environment Variables

```env
# .env additions

# Verification Provider (cronos-verify | mock)
VERIFY_PROVIDER=mock
CRONOS_VERIFY_API_URL=https://verify.cronos.org/api/v1
CRONOS_VERIFY_API_KEY=your-api-key

# ZK Proof Provider (noir | mock)
ZK_PROVIDER=mock

# Feature Flags
REQUIRE_VERIFICATION=false
USE_ZK_PROOFS=false

# Contract Addresses (optional upgrades)
VERIFICATION_REGISTRY_ADDRESS=
NOIR_VERIFIER_ADDRESS=
```

---

## Security Considerations

### 1. Verification Security

| Risk | Mitigation |
|------|------------|
| Cache poisoning | Short TTL (5 min), signed responses |
| Replay attacks | Include timestamp in verification |
| API key exposure | Environment variables, secrets manager |
| Provider downtime | Graceful degradation, don't block on error |

### 2. ZK Proof Security

| Risk | Mitigation |
|------|------------|
| Private input leakage | Never log privateInputs |
| Proof replay | Include intentId in public inputs |
| Circuit vulnerabilities | Audit circuits before production |
| Backend generates proofs | Acceptable for this use case (backend is trusted) |

### 3. Smart Contract Security

| Risk | Mitigation |
|------|------------|
| Upgrade risks | Use proxy pattern, timelock |
| Verifier bugs | Audit Noir verifier contract |
| Gas griefing | Limit proof size, gas caps |
| Emergency bypass | Owner can toggle features off |

---

## Implementation Order

### Phase 1: Backend Infrastructure (2-3 hours)
1. Create `apps/backend/src/zk/` directory structure
2. Implement interfaces
3. Implement MockVerifyProvider and MockZKProvider
4. Create service factory
5. Add to index.ts initialization

### Phase 2: Cronos Verify Integration (2-3 hours)
1. Implement CronosVerifyProvider
2. Integrate into Orchestrator
3. Add MCP tools
4. Test with mock provider

### Phase 3: Noir ZK Proofs (4-6 hours)
1. Write Noir circuit for price-condition
2. Compile circuit to JSON artifact
3. Implement NoirProvider
4. Integrate into Agent
5. Test proof generation/verification

### Phase 4: Smart Contract (Optional, 3-4 hours)
1. Deploy VerificationRegistry mock
2. Deploy NoirVerifier
3. Deploy SettlementV2 or upgrade existing
4. Update Orchestrator to use V2

---

## File Structure

```
apps/backend/src/
├── zk/
│   ├── interfaces/
│   │   ├── IVerifyProvider.ts
│   │   └── IZKProofProvider.ts
│   ├── providers/
│   │   ├── CronosVerifyProvider.ts
│   │   ├── MockVerifyProvider.ts
│   │   ├── NoirProvider.ts
│   │   └── MockZKProvider.ts
│   ├── circuits/
│   │   └── price_condition.json      # Compiled Noir circuit
│   └── factory.ts
├── services/
│   ├── verify-service.ts
│   └── zkproof-service.ts
└── ...existing files

contracts/contracts/
├── interfaces/
│   ├── IVerificationRegistry.sol
│   └── INoirVerifier.sol
├── SettlementV2.sol (optional)
└── ...existing files
```

---

## Testing Strategy

```typescript
// apps/backend/test/zk/verify-service.test.ts

describe('VerifyService', () => {
  it('should return verified for whitelisted addresses', async () => {
    const mockProvider = new MockVerifyProvider(['0x123...']);
    const service = new VerifyService(mockLogger, mockProvider);

    const result = await service.isVerified('0x123...');
    expect(result.isVerified).toBe(true);
  });

  it('should swap providers at runtime', async () => {
    const service = new VerifyService(mockLogger, new MockVerifyProvider());

    service.setProvider(new CronosVerifyProvider());
    expect(service.getProviderName()).toBe('cronos-verify');
  });
});
```

---

## Hackathon Tracks Coverage

| Track | How ZK Integration Helps |
|-------|--------------------------|
| **Main Track (x402)** | Verified recipients only can receive payments |
| **Agentic Finance** | AI agent uses ZK proofs for private condition evaluation |
| **Crypto.com Integration** | Cronos Verify is Crypto.com ecosystem |
| **Dev Tooling** | MCP tools for ZK verification + proof generation |

---

## Module 7: Noir Circuit (price-condition)

### Circuit Definition

```noir
// circuits/price_condition/src/main.nr

// Price Condition Circuit
// Proves: currentPrice < threshold WITHOUT revealing threshold
//
// Public Inputs:
//   - current_price: u64 (price * 1e8)
//   - intent_id_hash: Field (keccak256 of intentId)
//   - condition_met: u1 (1 if condition is true, 0 otherwise)
//
// Private Inputs:
//   - threshold: u64 (price threshold * 1e8)

fn main(
    // Public inputs
    current_price: pub u64,
    intent_id_hash: pub Field,
    condition_met: pub u1,
    // Private inputs (hidden)
    threshold: u64
) {
    // Constraint 1: Verify the condition_met flag is correct
    let actual_condition = current_price < threshold;

    // Convert bool to u1 for comparison
    let expected_met: u1 = if actual_condition { 1 } else { 0 };

    // Assert the public condition_met matches reality
    assert(condition_met == expected_met);

    // Constraint 2: Threshold must be positive
    assert(threshold > 0);

    // Constraint 3: Intent ID hash must be non-zero (binding)
    assert(intent_id_hash != 0);
}

#[test]
fn test_price_below_threshold() {
    // Current price: 0.08 USD (8_000_000 in 1e8)
    // Threshold: 0.10 USD (10_000_000 in 1e8)
    // Expected: condition_met = 1

    main(
        8_000_000,           // current_price
        0x1234567890abcdef,  // intent_id_hash
        1,                   // condition_met (true)
        10_000_000           // threshold (private)
    );
}

#[test]
fn test_price_above_threshold() {
    // Current price: 0.12 USD
    // Threshold: 0.10 USD
    // Expected: condition_met = 0

    main(
        12_000_000,          // current_price
        0x1234567890abcdef,  // intent_id_hash
        0,                   // condition_met (false)
        10_000_000           // threshold (private)
    );
}

#[test(should_fail)]
fn test_invalid_condition_flag() {
    // This should fail - claiming condition is met when it's not
    main(
        12_000_000,          // current_price (above threshold)
        0x1234567890abcdef,
        1,                   // WRONG: claiming condition met
        10_000_000           // threshold
    );
}
```

### Circuit Configuration

```toml
# circuits/price_condition/Nargo.toml

[package]
name = "price_condition"
type = "bin"
authors = ["Cronos x402 Team"]
compiler_version = ">=0.30.0"

[dependencies]
```

### Compile Circuit

```bash
# Install Noir
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup

# Compile circuit
cd circuits/price_condition
nargo compile

# Generate verifier contract (optional)
nargo codegen-verifier
```

---

## Module 8: Threat Model

### 8.1 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY 1                              │
│                     (Backend Server - Trusted)                       │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Agent     │    │ Orchestrator│    │ ZK Services │             │
│  │ (decision)  │    │ (execution) │    │ (proof gen) │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                      │
│                            │                                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────────┐
│                        TRUST BOUNDARY 2                              │
│                    (External APIs - Untrusted)                       │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Cronos      │    │ Crypto.com  │    │ CoinGecko   │             │
│  │ Verify API  │    │ MCP         │    │ API         │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────────┐
│                        TRUST BOUNDARY 3                              │
│                    (Blockchain - Trustless)                          │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Settlement  │    │ Noir        │    │ Verification│             │
│  │ Contract    │    │ Verifier    │    │ Registry    │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Attack Vectors & Mitigations

| ID | Attack | Component | Severity | Mitigation |
|----|--------|-----------|----------|------------|
| T1 | Private threshold leakage via logs | ZKProofService | HIGH | Never log `privateInputs`, use structured logging |
| T2 | Verification status cache poisoning | VerifyService | MEDIUM | Short TTL, verify API response signatures |
| T3 | Fake verification response from compromised API | CronosVerifyProvider | HIGH | Fallback to on-chain registry, signed responses |
| T4 | Proof replay for different intent | NoirProvider | HIGH | Include `intentId` in public inputs, one-time use |
| T5 | Gas griefing with large proofs | SettlementV2 | MEDIUM | Limit proof size, gas caps in contract |
| T6 | Malicious circuit artifact | NoirProvider | CRITICAL | Verify circuit hash, signed artifacts |
| T7 | Provider swap to malicious implementation | Factory | HIGH | Admin-only swap, audit trail |
| T8 | API key exposure | All providers | HIGH | Use secrets manager, rotate keys |
| T9 | Man-in-the-middle on verification API | CronosVerifyProvider | MEDIUM | TLS pinning, request signing |
| T10 | On-chain verifier bug | NoirVerifier.sol | CRITICAL | Audit, use official Noir verifier |

### 8.3 Security Requirements by Module

#### VerifyService
```
[REQ-V1] Cache TTL MUST be <= 5 minutes
[REQ-V2] All API responses MUST be validated before caching
[REQ-V3] Provider swap MUST emit audit event
[REQ-V4] Verification failure MUST NOT block execution (graceful degradation)
[REQ-V5] API keys MUST be stored in environment variables or secrets manager
```

#### ZKProofService
```
[REQ-Z1] Private inputs MUST NEVER appear in logs
[REQ-Z2] Proofs MUST include intentId to prevent replay
[REQ-Z3] Circuit artifacts MUST be loaded from verified source
[REQ-Z4] Proof generation MUST have timeout (prevent DoS)
[REQ-Z5] Failed proof generation MUST NOT leak private inputs in error
```

#### Smart Contracts
```
[REQ-C1] Verifier contract MUST be audited before mainnet
[REQ-C2] Feature flags MUST be owner-only controlled
[REQ-C3] Emergency disable MUST be available for all ZK features
[REQ-C4] Proof size MUST be limited to prevent gas griefing
[REQ-C5] Registry address MUST be updateable for upgrades
```

### 8.4 Audit Checklist

```markdown
## Pre-Deployment Audit Checklist

### Backend Services
- [ ] No private inputs in any log statements
- [ ] All API keys in environment variables
- [ ] Provider swap requires admin authorization
- [ ] Cache TTL configured correctly
- [ ] Timeout on all external API calls
- [ ] Error messages don't leak sensitive data

### Noir Circuit
- [ ] Circuit logic matches specification
- [ ] All edge cases tested
- [ ] Constraint count is reasonable
- [ ] No unconstrained private inputs
- [ ] Public inputs properly bound to intent

### Smart Contracts
- [ ] NoirVerifier from official Noir release
- [ ] Feature flags default to OFF
- [ ] Owner functions have access control
- [ ] Reentrancy guards in place
- [ ] Gas limits tested under load

### Integration
- [ ] End-to-end test with mock providers
- [ ] End-to-end test with real providers
- [ ] Failure modes tested (API down, invalid proofs)
- [ ] Provider swap tested in staging
```

---

## Module 9: Sequence Diagrams

### 9.1 Payment with Verification + ZK Proof

```
┌──────┐     ┌───────┐     ┌─────────┐     ┌──────────┐     ┌────────────┐     ┌──────────┐
│Client│     │  MCP  │     │  Agent  │     │ZKService │     │Orchestrator│     │Settlement│
└──┬───┘     └───┬───┘     └────┬────┘     └────┬─────┘     └─────┬──────┘     └────┬─────┘
   │             │              │               │                  │                 │
   │ trigger_agent(intentId)    │               │                  │                 │
   │────────────>│              │               │                  │                 │
   │             │              │               │                  │                 │
   │             │ evaluate()   │               │                  │                 │
   │             │─────────────>│               │                  │                 │
   │             │              │               │                  │                 │
   │             │              │ fetchPrice()  │                  │                 │
   │             │              │──────────────>│                  │                 │
   │             │              │<──────────────│                  │                 │
   │             │              │               │                  │                 │
   │             │              │ generateProof(price, threshold)  │                 │
   │             │              │──────────────>│                  │                 │
   │             │              │               │ ┌──────────────┐ │                 │
   │             │              │               │ │Noir circuit  │ │                 │
   │             │              │               │ │(threshold    │ │                 │
   │             │              │               │ │ is HIDDEN)   │ │                 │
   │             │              │               │ └──────────────┘ │                 │
   │             │              │<──────────────│ proof           │                 │
   │             │              │               │                  │                 │
   │             │ decision +   │               │                  │                 │
   │             │ proof        │               │                  │                 │
   │             │<─────────────│               │                  │                 │
   │             │              │               │                  │                 │
   │             │ execute(intent, decision, proof)                │                 │
   │             │─────────────────────────────────────────────────>                 │
   │             │              │               │                  │                 │
   │             │              │               │       isVerified(recipient)        │
   │             │              │               │                  │────────────────>│
   │             │              │               │                  │<────────────────│
   │             │              │               │                  │  ✓ verified     │
   │             │              │               │                  │                 │
   │             │              │               │                  │ executeSettlement
   │             │              │               │                  │────────────────>│
   │             │              │               │                  │<────────────────│
   │             │              │               │                  │  txHash         │
   │<────────────────────────────────────────────────────────────────────────────────│
   │             │  { txHash, proof }           │                  │                 │
   │             │              │               │                  │                 │
```

### 9.2 Provider Swap (Runtime)

```
┌─────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────────────┐
│Admin│     │VerifyService  │     │MockProvider │     │CronosVerifyProvider│
└──┬──┘     └───────┬───────┘     └──────┬──────┘     └────────┬─────────┘
   │                │                    │                     │
   │ setProvider(cronosVerify)           │                     │
   │───────────────>│                    │                     │
   │                │                    │                     │
   │                │ clearCache()       │                     │
   │                │───────────────────>│                     │
   │                │                    │                     │
   │                │ provider = cronosVerify                  │
   │                │─────────────────────────────────────────>│
   │                │                    │                     │
   │                │ emit ProviderSwapped                     │
   │                │───────────────────────────────────────────────>
   │                │                    │                     │
   │<───────────────│                    │                     │
   │  ✓ swapped     │                    │                     │
```

---

## Next Steps

1. [ ] Create `apps/backend/src/zk/` directory
2. [ ] Implement interfaces and mock providers
3. [ ] Add feature flags to `.env`
4. [ ] Test with mocks
5. [ ] Integrate Cronos Verify API
6. [ ] Write and compile Noir circuit
7. [ ] Deploy NoirVerifier contract
8. [ ] End-to-end integration test
9. [ ] Security audit
10. [ ] Deploy to testnet

