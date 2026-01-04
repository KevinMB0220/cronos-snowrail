/**
 * ZK Proof Provider Interface - LEGO #2
 *
 * Abstraction for zero-knowledge proof generation and verification.
 * Implementations can be swapped without changing consumer code.
 *
 * Current implementations:
 * - NoirProvider: Noir/Barretenberg proofs
 * - MockZKProvider: Testing/development
 */

export type ZKConditionType = 'price-below' | 'price-above' | 'amount-range' | 'custom';

export interface ZKProofInput {
  /** Type of condition to prove */
  type: ZKConditionType;
  /** Private inputs - hidden from observers */
  privateInputs: Record<string, string | number>;
  /** Public inputs - visible in proof */
  publicInputs: Record<string, string | number>;
}

export interface ZKProof {
  /** Hex-encoded proof data */
  proof: string;
  /** Public signals/outputs from the proof */
  publicSignals: string[];
  /** Verifier contract address (if deployed) */
  verifierContract?: string;
  /** Circuit identifier */
  circuitId: string;
}

export interface IZKProofProvider {
  /** Provider identifier */
  readonly name: string;
  /** List of supported circuit types */
  readonly supportedCircuits: string[];

  /**
   * Generate ZK proof for given inputs
   * @param input - Proof inputs (private + public)
   * @returns Generated proof with public signals
   */
  generateProof(input: ZKProofInput): Promise<ZKProof>;

  /**
   * Verify proof off-chain (for testing/preview)
   * @param proof - Proof to verify
   * @returns true if proof is valid
   */
  verifyProofOffChain(proof: ZKProof): Promise<boolean>;

  /**
   * Get verifier contract address for on-chain verification
   * @param circuitId - Circuit identifier
   * @returns Contract address
   */
  getVerifierContract(circuitId: string): Promise<string | undefined>;

  /**
   * Health check for the provider
   * @returns true if provider is operational
   */
  healthCheck(): Promise<boolean>;
}
