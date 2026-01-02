/**
 * ZK Proof Service
 * Manages zero-knowledge proof generation with pluggable providers
 */

import { FastifyInstance } from 'fastify';
import { ethers } from 'ethers';
import {
  IZKProofProvider,
  ZKProofInput,
  ZKProof,
  VerifyProofResult,
} from '../zk/interfaces/IZKProofProvider';

// Singleton instance
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
    throw new Error('ZKProofService not initialized. Call initializeZKProofService first.');
  }
  return zkProofServiceInstance;
}

export class ZKProofService {
  // Proof cache with short TTL
  private proofCache = new Map<string, { proof: ZKProof; expires: number }>();
  private readonly PROOF_CACHE_TTL = 60000; // 1 minute

  constructor(
    private logger: FastifyInstance['log'],
    private provider: IZKProofProvider
  ) {}

  /**
   * Generate proof for price-below condition WITHOUT revealing threshold
   *
   * REQ-Z1: Private inputs MUST NEVER appear in logs
   * REQ-Z2: Proofs MUST include intentId to prevent replay
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

    // Convert to integers for circuit (8 decimal places)
    const currentPriceInt = Math.floor(currentPrice * 1e8);
    const thresholdInt = Math.floor(threshold * 1e8);
    const conditionMet = currentPrice < threshold ? '1' : '0';

    // Hash intentId for circuit and reduce to BN254 field
    const rawHash = ethers.keccak256(ethers.toUtf8Bytes(intentId));
    const BN254_FIELD_MODULUS = BigInt(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );
    const hashBigInt = BigInt(rawHash);
    const fieldElement = hashBigInt % BN254_FIELD_MODULUS;
    const intentIdHash = '0x' + fieldElement.toString(16).padStart(64, '0');

    const input: ZKProofInput = {
      circuitId: 'price-condition',
      privateInputs: {
        threshold: thresholdInt.toString(), // NEVER log this
      },
      publicInputs: {
        current_price: currentPriceInt.toString(),
        intent_id_hash: intentIdHash,
        condition_met: conditionMet,
      },
    };

    const proof = await this.provider.generateProof(input);

    this.logger.info(
      { intentId, circuitId: proof.circuitId },
      '[ZKProofService] Proof generated successfully'
    );

    return proof;
  }

  /**
   * Generate proof for private transfer WITHOUT revealing sender, recipient, or amount
   *
   * Kevin sends to Juan - observers only see:
   * - A valid transfer happened
   * - Transfer hash (for on-chain tracking)
   * - That sender had sufficient balance
   *
   * HIDDEN: Who sent, who received, how much
   *
   * REQ-Z1: Private inputs MUST NEVER appear in logs
   */
  async generatePrivateTransferProof(
    senderAddress: string,
    recipientAddress: string,
    amount: number,
    senderBalance: number,
    senderSecret: string
  ): Promise<ZKProof> {
    // SECURITY: Never log any private data
    this.logger.info(
      { circuit: 'private-transfer' },
      '[ZKProofService] Generating private transfer proof (all details hidden)'
    );

    const BN254_FIELD_MODULUS = BigInt(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );

    // Hash addresses to field elements
    const senderHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes(senderAddress))) % BN254_FIELD_MODULUS;
    const recipientHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes(recipientAddress))) % BN254_FIELD_MODULUS;
    const secretBigInt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(senderSecret))) % BN254_FIELD_MODULUS;

    // Generate random nonce
    const nonce = BigInt(ethers.keccak256(ethers.randomBytes(32))) % BN254_FIELD_MODULUS;

    // Compute public values (matching circuit logic)
    const amountBigInt = BigInt(Math.floor(amount * 1e8)); // Convert to 8 decimals
    const balanceBigInt = BigInt(Math.floor(senderBalance * 1e8));

    const transferHash = senderHash + recipientHash * 2n + amountBigInt * 3n + nonce * 5n;
    const nullifier = secretBigInt * 7n + nonce * 11n;
    const balanceSufficient = balanceBigInt >= amountBigInt ? '1' : '0';

    const input: ZKProofInput = {
      circuitId: 'private-transfer',
      publicInputs: {
        transfer_hash: '0x' + transferHash.toString(16),
        nullifier: '0x' + nullifier.toString(16),
        balance_sufficient: balanceSufficient,
      },
      privateInputs: {
        sender_address: '0x' + senderHash.toString(16),
        recipient_address: '0x' + recipientHash.toString(16),
        amount: amountBigInt.toString(),
        sender_balance: balanceBigInt.toString(),
        nonce: '0x' + nonce.toString(16),
        sender_secret: '0x' + secretBigInt.toString(16),
      },
    };

    const proof = await this.provider.generateProof(input);

    this.logger.info(
      { circuitId: proof.circuitId, balanceSufficient },
      '[ZKProofService] Private transfer proof generated (sender, recipient, amount hidden)'
    );

    return proof;
  }

  /**
   * Generate a generic proof
   */
  async generateProof(input: ZKProofInput): Promise<ZKProof> {
    // REQ-Z1: Never log private inputs
    this.logger.info(
      { circuitId: input.circuitId },
      '[ZKProofService] Generating proof'
    );

    return this.provider.generateProof(input);
  }

  /**
   * Verify a proof off-chain
   */
  async verifyProof(proof: ZKProof): Promise<VerifyProofResult> {
    this.logger.info(
      { circuitId: proof.circuitId },
      '[ZKProofService] Verifying proof'
    );

    const result = await this.provider.verifyProof(proof);

    this.logger.info(
      { circuitId: proof.circuitId, isValid: result.isValid },
      '[ZKProofService] Proof verification complete'
    );

    return result;
  }

  /**
   * Swap provider at runtime (LEGO swap)
   */
  setProvider(newProvider: IZKProofProvider): void {
    const oldProvider = this.provider.name;
    this.provider = newProvider;
    this.proofCache.clear();

    this.logger.info(
      { oldProvider, newProvider: newProvider.name },
      '[ZKProofService] Provider swapped'
    );
  }

  /**
   * Get available circuits
   */
  getAvailableCircuits(): string[] {
    return this.provider.getCircuits();
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
}
