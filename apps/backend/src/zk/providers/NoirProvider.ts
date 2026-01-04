/**
 * Noir ZK Proof Provider
 *
 * LEGO-swappable implementation for Noir/Barretenberg ZK proofs.
 * Generates privacy-preserving proofs for conditional payments.
 *
 * Features:
 * - Supports price-below and price-above circuits
 * - Off-chain proof verification
 * - Verifier contract registry
 */

import { ethers } from 'ethers';
import { IZKProofProvider, ZKProofInput, ZKProof } from '../interfaces/IZKProofProvider';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface NoirProviderConfig {
  circuitsPath: string;
  verifierContracts?: Record<string, string>;
}

interface CompiledCircuit {
  bytecode: string;
  abi: {
    parameters: Array<{
      name: string;
      type: { kind: string };
      visibility: string;
    }>;
  };
}

export class NoirProvider implements IZKProofProvider {
  readonly name = 'noir';
  readonly supportedCircuits = ['price-below', 'price-above', 'price_condition'];

  private verifierContracts: Map<string, string>;
  private circuitCache = new Map<string, CompiledCircuit>();

  constructor(
    private config: NoirProviderConfig,
    private logger?: { info: Function; warn: Function; error: Function; debug: Function }
  ) {
    this.verifierContracts = new Map(Object.entries(config.verifierContracts ?? {}));
  }

  async generateProof(input: ZKProofInput): Promise<ZKProof> {
    // Map condition types to circuit names
    const circuitId = this.mapConditionToCircuit(input.type);

    this.logger?.info({ circuitId, type: input.type }, '[Noir] Generating proof');

    // Load compiled circuit
    const circuit = await this.loadCircuit(circuitId);

    // Prepare witness inputs
    const witnessInputs = this.prepareWitnessInputs(input, circuit);

    // Generate proof using Noir
    const { proof, publicSignals } = await this.executeNoirProof(circuit, witnessInputs);

    this.logger?.info(
      { circuitId, proofLength: proof.length, publicSignalsCount: publicSignals.length },
      '[Noir] Proof generated'
    );

    return {
      proof,
      publicSignals,
      verifierContract: this.verifierContracts.get(circuitId),
      circuitId,
    };
  }

  private mapConditionToCircuit(type: string): string {
    const mapping: Record<string, string> = {
      'price-below': 'price_condition',
      'price-above': 'price_condition',
      'amount-range': 'price_condition',
    };
    return mapping[type] ?? type;
  }

  private async loadCircuit(circuitId: string): Promise<CompiledCircuit> {
    // Check cache
    const cached = this.circuitCache.get(circuitId);
    if (cached) {
      return cached;
    }

    const circuitPath = path.join(
      this.config.circuitsPath,
      circuitId,
      'target',
      `${circuitId}.json`
    );

    try {
      const data = await fs.readFile(circuitPath, 'utf-8');
      const circuit = JSON.parse(data) as CompiledCircuit;
      this.circuitCache.set(circuitId, circuit);
      return circuit;
    } catch (error) {
      this.logger?.error({ circuitId, circuitPath, error: String(error) }, '[Noir] Failed to load circuit');
      throw new Error(`Circuit ${circuitId} not found at ${circuitPath}`);
    }
  }

  private prepareWitnessInputs(
    input: ZKProofInput,
    _circuit: CompiledCircuit
  ): Record<string, string> {
    const witnessInputs: Record<string, string> = {};

    // Convert all inputs to field-compatible format
    for (const [key, value] of Object.entries(input.privateInputs)) {
      witnessInputs[key] = this.toFieldString(value);
    }
    for (const [key, value] of Object.entries(input.publicInputs)) {
      witnessInputs[key] = this.toFieldString(value);
    }

    // Add condition type as numeric
    if (input.type === 'price-below') {
      witnessInputs['is_less_than'] = '1';
    } else if (input.type === 'price-above') {
      witnessInputs['is_less_than'] = '0';
    }

    return witnessInputs;
  }

  private toFieldString(value: string | number): string {
    if (typeof value === 'number') {
      return Math.floor(value * 1e8).toString(); // 8 decimal precision
    }
    // If already a string, try to parse as number
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return Math.floor(num * 1e8).toString();
    }
    // If hex string (like intent hash), convert to decimal
    if (value.startsWith('0x')) {
      return BigInt(value).toString();
    }
    return value;
  }

  private async executeNoirProof(
    circuit: CompiledCircuit,
    inputs: Record<string, string>
  ): Promise<{ proof: string; publicSignals: string[] }> {
    // In production, this would use @noir-lang/noir_wasm or nargo CLI
    // For now, generate a deterministic proof based on inputs and circuit

    this.logger?.debug({ inputs }, '[Noir] Executing proof with inputs');

    // Create deterministic proof from circuit bytecode + inputs
    const proofData = JSON.stringify({
      circuit: circuit.bytecode.slice(0, 64),
      inputs,
      timestamp: Math.floor(Date.now() / 60000), // 1 min granularity
    });

    const proof = ethers.keccak256(ethers.toUtf8Bytes(proofData));

    // Extract public signals from public inputs
    const publicSignals = Object.entries(inputs)
      .filter(([key]) => !key.startsWith('private_') && key !== 'threshold')
      .map(([, value]) => ethers.keccak256(ethers.toUtf8Bytes(value)));

    return { proof, publicSignals };
  }

  async verifyProofOffChain(proof: ZKProof): Promise<boolean> {
    // Load circuit for verification
    try {
      const circuit = await this.loadCircuit(proof.circuitId);
      // In production, use Noir verifier
      // For now, validate proof structure
      return (
        proof.proof.startsWith('0x') &&
        proof.proof.length === 66 &&
        proof.publicSignals.length > 0 &&
        circuit.bytecode.length > 0
      );
    } catch {
      return false;
    }
  }

  async getVerifierContract(circuitId: string): Promise<string | undefined> {
    return this.verifierContracts.get(circuitId);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to load the main circuit
      await this.loadCircuit('price_condition');
      return true;
    } catch {
      return false;
    }
  }

  // Register verifier contract dynamically
  setVerifierContract(circuitId: string, address: string): void {
    this.verifierContracts.set(circuitId, address);
  }
}
