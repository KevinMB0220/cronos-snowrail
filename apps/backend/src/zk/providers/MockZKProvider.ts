/**
 * Mock ZK Proof Provider
 *
 * LEGO-swappable implementation for testing and development.
 * Generates deterministic mock proofs based on inputs.
 */

import { ethers } from 'ethers';
import { IZKProofProvider, ZKProofInput, ZKProof } from '../interfaces/IZKProofProvider';

export class MockZKProvider implements IZKProofProvider {
  readonly name = 'mock-zk';
  readonly supportedCircuits = ['price-below', 'price-above', 'amount-range'];

  async generateProof(input: ZKProofInput): Promise<ZKProof> {
    // Validate circuit support
    if (!this.supportedCircuits.includes(input.type)) {
      throw new Error(`Circuit ${input.type} not supported by MockZKProvider`);
    }

    // Simulate proof generation delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate deterministic mock proof from inputs
    const inputData = JSON.stringify({
      type: input.type,
      public: input.publicInputs,
      // Note: private inputs included in hash but not in output
      private: input.privateInputs,
    });
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(inputData));

    // Create mock public signals from public inputs
    const publicSignals = Object.entries(input.publicInputs).map(([key, value]) => {
      // Hash each public input to simulate field elements
      return ethers.keccak256(ethers.toUtf8Bytes(`${key}:${value}`));
    });

    return {
      proof: proofHash,
      publicSignals,
      circuitId: input.type,
      // No verifier contract for mock
    };
  }

  async verifyProofOffChain(proof: ZKProof): Promise<boolean> {
    // Mock provider always returns true for valid-looking proofs
    return proof.proof.startsWith('0x') && proof.proof.length === 66;
  }

  async getVerifierContract(_circuitId: string): Promise<string | undefined> {
    // Mock provider has no deployed verifier
    return undefined;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
