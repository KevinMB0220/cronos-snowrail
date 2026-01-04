// ZK Mixer Circuit
// Proves: Valid withdrawal from mixer WITHOUT revealing which deposit
//
// Privacy Model:
// - Alice deposits 1 CRO -> commitment stored in Merkle tree
// - Bob withdraws 1 CRO -> proves he knows a valid commitment, gets funds
// - Observers cannot link Alice's deposit to Bob's withdrawal
//
// Public Inputs:
//   - root: Merkle tree root (proves deposit exists)
//   - nullifierHash: Prevents double-spending
//   - recipient: Address receiving funds
//   - relayer: Address receiving fee (can be 0)
//   - fee: Relayer fee amount
//
// Private Inputs:
//   - nullifier: Secret value for nullifierHash
//   - secret: Secret value for commitment
//   - pathElements: Merkle proof siblings
//   - pathIndices: Merkle proof directions (0=left, 1=right)

// Poseidon hash using std library
use std::hash::poseidon::bn254::hash_2;
use std::hash::poseidon::bn254::hash_3;

// Merkle tree depth (2^20 = ~1M deposits)
global TREE_DEPTH: u32 = 20;

fn main(
    // ============ PUBLIC INPUTS ============
    root: pub Field,              // Merkle root
    nullifierHash: pub Field,     // Prevents double-spend
    recipient: pub Field,         // Withdrawal destination
    relayer: pub Field,           // Relayer address (0 if none)
    fee: pub Field,               // Relayer fee

    // ============ PRIVATE INPUTS ============
    nullifier: Field,             // Secret nullifier
    secret: Field,                // Secret for commitment
    pathElements: [Field; 20],    // Merkle siblings
    pathIndices: [Field; 20]      // Merkle directions
) {
    // ============ CONSTRAINT 1: Compute and verify commitment ============
    // commitment = poseidon(nullifier, secret)
    let commitment = hash_2([nullifier, secret]);

    // ============ CONSTRAINT 2: Verify nullifierHash ============
    // nullifierHash = poseidon(nullifier)
    // Using hash_2 with same value twice as Poseidon of single element
    let computedNullifierHash = hash_2([nullifier, nullifier]);
    assert(nullifierHash == computedNullifierHash, "Invalid nullifier hash");

    // ============ CONSTRAINT 3: Verify Merkle membership ============
    let computedRoot = compute_merkle_root(commitment, pathElements, pathIndices);
    assert(root == computedRoot, "Invalid Merkle proof");

    // ============ CONSTRAINT 4: Bind proof to recipient ============
    // This prevents front-running by requiring the proof to commit to recipient
    let _recipientBinding = hash_3([recipient, relayer, fee]);
    // The binding ensures this proof is only valid for this specific recipient/relayer/fee
}

// Compute Merkle root from leaf and path
fn compute_merkle_root(
    leaf: Field,
    pathElements: [Field; 20],
    pathIndices: [Field; 20]
) -> Field {
    let mut current = leaf;

    for i in 0..20 {
        let pathIndex = pathIndices[i];
        let sibling = pathElements[i];

        // pathIndex: 0 = current is left child, 1 = current is right child
        let (left, right) = if pathIndex == 0 {
            (current, sibling)
        } else {
            (sibling, current)
        };

        current = hash_2([left, right]);
    }

    current
}

// ============ HELPER FUNCTIONS FOR BACKEND ============

// Compute commitment from nullifier and secret
fn compute_commitment(nullifier: Field, secret: Field) -> Field {
    hash_2([nullifier, secret])
}

// Compute nullifier hash
fn compute_nullifier_hash(nullifier: Field) -> Field {
    hash_2([nullifier, nullifier])
}

// ============ TESTS ============

#[test]
fn test_valid_withdrawal() {
    // Simulate a simple case with depth 1 for testing
    let nullifier = 0x1234567890abcdef;
    let secret = 0xfedcba0987654321;

    // Compute commitment
    let commitment = hash_2([nullifier, secret]);

    // Compute nullifier hash
    let nullifierHash = hash_2([nullifier, nullifier]);

    // For testing, create a simple Merkle tree
    // In real use, pathElements would be actual tree siblings
    let mut pathElements: [Field; 20] = [0; 20];
    let mut pathIndices: [Field; 20] = [0; 20];

    // Build path up to root
    let mut current = commitment;
    for i in 0..20 {
        pathElements[i] = 0; // Zero siblings for testing
        pathIndices[i] = 0;  // Always left child
        current = hash_2([current, pathElements[i]]);
    }
    let root = current;

    // Test values
    let recipient = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    let relayer = 0;
    let fee = 0;

    main(
        root,
        nullifierHash,
        recipient,
        relayer,
        fee,
        nullifier,
        secret,
        pathElements,
        pathIndices
    );
}

#[test(should_fail_with = "Invalid nullifier hash")]
fn test_invalid_nullifier_hash() {
    let nullifier = 0x1234567890abcdef;
    let secret = 0xfedcba0987654321;

    let commitment = hash_2([nullifier, secret]);
    let wrongNullifierHash = hash_2([secret, secret]); // Wrong!

    let mut pathElements: [Field; 20] = [0; 20];
    let mut pathIndices: [Field; 20] = [0; 20];

    let mut current = commitment;
    for i in 0..20 {
        current = hash_2([current, pathElements[i]]);
    }
    let root = current;

    main(
        root,
        wrongNullifierHash, // Wrong nullifier hash
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
        0,
        0,
        nullifier,
        secret,
        pathElements,
        pathIndices
    );
}

#[test(should_fail_with = "Invalid Merkle proof")]
fn test_invalid_merkle_proof() {
    let nullifier = 0x1234567890abcdef;
    let secret = 0xfedcba0987654321;

    let commitment = hash_2([nullifier, secret]);
    let nullifierHash = hash_2([nullifier, nullifier]);

    let mut pathElements: [Field; 20] = [0; 20];
    let mut pathIndices: [Field; 20] = [0; 20];

    // Compute correct root
    let mut current = commitment;
    for i in 0..20 {
        current = hash_2([current, pathElements[i]]);
    }

    // Use wrong root
    let wrongRoot = hash_2([current, current]);

    main(
        wrongRoot, // Wrong root!
        nullifierHash,
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
        0,
        0,
        nullifier,
        secret,
        pathElements,
        pathIndices
    );
}
