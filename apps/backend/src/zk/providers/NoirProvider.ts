/**
 * Noir ZK Proof Provider
 * LEGO #5: Zero-knowledge proof generation using Noir
 *
 * Supports circuits:
 * - price-condition: Proves currentPrice < threshold WITHOUT revealing threshold
 * - private-transfer: Proves valid transfer WITHOUT revealing sender, recipient, or amount
 */

import { ethers } from 'ethers';
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  IZKProofProvider,
  ZKProofInput,
  ZKProof,
  VerifyProofResult,
} from '../interfaces/IZKProofProvider';

// Type for the compiled circuit
interface CompiledCircuit {
  bytecode: string;
  abi: {
    parameters: Array<{
      name: string;
      type: { kind: string; sign?: string; width?: number };
      visibility: string;
    }>;
  };
}

// Path to compiled circuits (relative to project root)
const CIRCUITS_PATH = join(__dirname, '../../../../../circuits');

// BN254 field modulus (for Noir's native field)
const BN254_FIELD_MODULUS = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

export class NoirProvider implements IZKProofProvider {
  readonly name = 'noir';

  private circuits: Map<string, CompiledCircuit> = new Map();
  private backends: Map<string, BarretenbergBackend> = new Map();
  private noirInstances: Map<string, Noir> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start initialization
    this.initPromise = this.loadCircuits();
  }

  private async loadCircuits(): Promise<void> {
    try {
      console.log('[NoirProvider] Loading compiled circuits...');

      // Load price_condition circuit
      await this.loadCircuit('price-condition', 'price_condition/target/price_condition.json');

      // Load private_transfer circuit
      await this.loadCircuit('private-transfer', 'private_transfer/target/private_transfer.json');

      this.initialized = true;
      console.log('[NoirProvider] Circuits loaded successfully');
      console.log('[NoirProvider] Available circuits:', this.getCircuits());
    } catch (error) {
      console.error('[NoirProvider] Circuit loading error:', error);
      throw error;
    }
  }

  private async loadCircuit(circuitId: string, relativePath: string): Promise<void> {
    const circuitPath = join(CIRCUITS_PATH, relativePath);

    if (!existsSync(circuitPath)) {
      console.warn(`[NoirProvider] Circuit not found: ${circuitPath}`);
      return;
    }

    const circuitJson = readFileSync(circuitPath, 'utf-8');
    const circuit = JSON.parse(circuitJson) as CompiledCircuit;
    this.circuits.set(circuitId, circuit);

    // Initialize Barretenberg backend for the circuit
    const backend = new BarretenbergBackend(circuit as any);
    this.backends.set(circuitId, backend);

    // Initialize Noir instance
    const noir = new Noir(circuit as any);
    this.noirInstances.set(circuitId, noir);

    console.log(`[NoirProvider] Loaded circuit: ${circuitId}`);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
    if (!this.initialized) {
      throw new Error('NoirProvider not initialized');
    }
  }

  async generateProof(input: ZKProofInput): Promise<ZKProof> {
    await this.ensureInitialized();

    const circuit = this.circuits.get(input.circuitId);
    const backend = this.backends.get(input.circuitId);
    const noir = this.noirInstances.get(input.circuitId);

    if (!circuit || !backend || !noir) {
      throw new Error(`Circuit not found: ${input.circuitId}`);
    }

    // REQ-Z1: Private inputs MUST NEVER appear in logs
    // Only log circuit ID and public input keys
    console.log('[NoirProvider] Generating proof for circuit:', input.circuitId);
    console.log('[NoirProvider] Public inputs:', Object.keys(input.publicInputs as object));

    try {
      // Combine public and private inputs for the prover
      const witnessInputs = {
        ...(input.publicInputs as object),
        ...(input.privateInputs as object),
      };

      // Generate witness (execute circuit to compute intermediate values)
      const { witness } = await noir.execute(witnessInputs);

      // Generate proof using Barretenberg backend
      const proof = await backend.generateProof(witness);

      // Extract public inputs from the proof
      const publicSignals = proof.publicInputs?.map(String) || [];

      // Convert proof bytes to hex string
      const proofHex = '0x' + Buffer.from(proof.proof).toString('hex');

      console.log('[NoirProvider] Proof generated successfully');

      return {
        proof: proofHex,
        publicSignals,
        circuitId: input.circuitId,
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[NoirProvider] Proof generation failed:', error);
      throw new Error(`Proof generation failed: ${(error as Error).message}`);
    }
  }

  async verifyProof(proof: ZKProof): Promise<VerifyProofResult> {
    await this.ensureInitialized();

    const circuit = this.circuits.get(proof.circuitId);
    const backend = this.backends.get(proof.circuitId);

    if (!circuit || !backend) {
      throw new Error(`Circuit not found: ${proof.circuitId}`);
    }

    console.log('[NoirProvider] Verifying proof for circuit:', proof.circuitId);

    try {
      // Convert hex proof back to Uint8Array
      const proofBytes = Uint8Array.from(
        Buffer.from(proof.proof.replace('0x', ''), 'hex')
      );

      // Reconstruct proof object for verification
      const proofToVerify = {
        proof: proofBytes,
        publicInputs: proof.publicSignals,
      };

      // Verify the proof
      const isValid = await backend.verifyProof(proofToVerify as any);

      console.log('[NoirProvider] Proof verification result:', isValid);

      return {
        isValid,
        verifiedAt: Date.now(),
        circuitId: proof.circuitId,
      };
    } catch (error) {
      console.error('[NoirProvider] Proof verification failed:', error);
      return {
        isValid: false,
        verifiedAt: Date.now(),
        circuitId: proof.circuitId,
        error: (error as Error).message,
      };
    }
  }

  getCircuits(): string[] {
    return Array.from(this.circuits.keys());
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.initialized && this.circuits.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Convert a keccak256 hash to a valid BN254 field element
   * by taking modulo of the field modulus
   */
  static hashToField(hash: string): string {
    const hashBigInt = BigInt(hash);
    const fieldElement = hashBigInt % BN254_FIELD_MODULUS;
    // Return as hex string with 0x prefix
    return '0x' + fieldElement.toString(16).padStart(64, '0');
  }

  /**
   * Compute transfer hash for private transfer circuit
   */
  static computeTransferHash(
    senderHash: bigint,
    recipientHash: bigint,
    amount: bigint,
    nonce: bigint
  ): bigint {
    // Must match the circuit's compute_transfer_hash function
    return senderHash + recipientHash * 2n + amount * 3n + nonce * 5n;
  }

  /**
   * Compute nullifier for private transfer circuit
   */
  static computeNullifier(secret: bigint, nonce: bigint): bigint {
    // Must match the circuit's compute_nullifier function
    return secret * 7n + nonce * 11n;
  }

  /**
   * Helper method to create proof inputs for private transfer
   * Kevin sends to Juan - no one knows who sent, who received, or how much
   *
   * @param senderAddress - Sender's address (PRIVATE - never revealed)
   * @param recipientAddress - Recipient's address (PRIVATE - never revealed)
   * @param amount - Transfer amount (PRIVATE - never revealed)
   * @param senderBalance - Sender's current balance (PRIVATE - never revealed)
   * @param senderSecret - Sender's secret for nullifier (PRIVATE - never revealed)
   */
  static createPrivateTransferInput(
    senderAddress: string,
    recipientAddress: string,
    amount: bigint,
    senderBalance: bigint,
    senderSecret: bigint
  ): ZKProofInput {
    // Hash addresses to field elements
    const senderHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes(senderAddress))) % BN254_FIELD_MODULUS;
    const recipientHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes(recipientAddress))) % BN254_FIELD_MODULUS;

    // Generate random nonce
    const nonce = BigInt(ethers.keccak256(ethers.randomBytes(32))) % BN254_FIELD_MODULUS;

    // Compute public values
    const transferHash = NoirProvider.computeTransferHash(senderHash, recipientHash, amount, nonce);
    const nullifier = NoirProvider.computeNullifier(senderSecret, nonce);
    const balanceSufficient = senderBalance >= amount ? '1' : '0';

    return {
      circuitId: 'private-transfer',
      publicInputs: {
        transfer_hash: '0x' + transferHash.toString(16),
        nullifier: '0x' + nullifier.toString(16),
        balance_sufficient: balanceSufficient,
      },
      privateInputs: {
        sender_address: '0x' + senderHash.toString(16),
        recipient_address: '0x' + recipientHash.toString(16),
        amount: amount.toString(),
        sender_balance: senderBalance.toString(),
        nonce: '0x' + nonce.toString(16),
        sender_secret: '0x' + senderSecret.toString(16),
      },
    };
  }

  /**
   * Helper method to create proof inputs for price condition
   * @param currentPrice - Current price in 1e8 format (e.g., 0.08 USD = 8_000_000)
   * @param intentId - Intent ID (will be hashed and reduced to field)
   * @param threshold - Price threshold in 1e8 format (PRIVATE - never revealed)
   */
  static createPriceConditionInput(
    currentPrice: bigint,
    intentId: string,
    threshold: bigint
  ): ZKProofInput {
    // Hash the intent ID using keccak256
    const rawHash = ethers.keccak256(ethers.toUtf8Bytes(intentId));

    // Reduce hash to valid BN254 field element
    const intentIdHash = NoirProvider.hashToField(rawHash);

    // Determine if condition is met (price < threshold)
    const conditionMet = currentPrice < threshold ? '1' : '0';

    return {
      circuitId: 'price-condition',
      publicInputs: {
        current_price: currentPrice.toString(),
        intent_id_hash: intentIdHash,
        condition_met: conditionMet,
      },
      privateInputs: {
        threshold: threshold.toString(),
      },
    };
  }
}
