/**
 * ZK Proof Provider Interface
 * LEGO Module: Swappable ZK proof generation/verification
 */

export interface ZKProofInput {
  circuitId: string;          // Which circuit to use
  privateInputs: unknown;     // Secret inputs (NEVER log these)
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
  error?: string;
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
