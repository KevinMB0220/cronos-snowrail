// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZKMixer
 * @notice Privacy-preserving mixer using ZK proofs
 * @dev Users deposit fixed amounts, then withdraw to different addresses
 *      without revealing the link between deposit and withdrawal
 *
 * Privacy Model:
 * - Alice deposits 1 CRO with commitment = hash(nullifier, secret)
 * - Bob withdraws 1 CRO proving he knows nullifier + secret for a valid commitment
 * - Observers see both transactions but cannot link them
 */
contract ZKMixer is ReentrancyGuard {
    // ============ Constants ============
    uint256 public constant DENOMINATION = 0.1 ether;  // Fixed deposit amount (0.1 CRO)
    uint32 public constant MERKLE_TREE_HEIGHT = 20;    // 2^20 = ~1M deposits
    uint32 public constant ROOT_HISTORY_SIZE = 30;     // Store last 30 roots

    // ============ State Variables ============

    // Merkle tree state
    bytes32[30] public roots;                          // Root history
    uint32 public currentRootIndex;
    uint32 public nextLeafIndex;

    // Sparse merkle tree: filledSubtrees[level] = hash of last filled subtree
    bytes32[20] public filledSubtrees;

    // Zero values for each level (precomputed)
    bytes32[20] public zeros;

    // Nullifier tracking (prevents double-spend)
    mapping(bytes32 => bool) public nullifierHashes;

    // Commitment tracking (prevents duplicate deposits)
    mapping(bytes32 => bool) public commitments;

    // ============ Events ============
    event Deposit(
        bytes32 indexed commitment,
        uint32 leafIndex,
        uint256 timestamp
    );

    event Withdrawal(
        address indexed recipient,
        bytes32 nullifierHash,
        address indexed relayer,
        uint256 fee
    );

    // ============ Constructor ============
    constructor() {
        // Initialize zero values using Poseidon-like hash simulation
        // In production, use actual Poseidon hashes
        bytes32 currentZero = bytes32(0);
        zeros[0] = currentZero;
        filledSubtrees[0] = currentZero;

        for (uint32 i = 1; i < MERKLE_TREE_HEIGHT; i++) {
            currentZero = _hashPair(currentZero, currentZero);
            zeros[i] = currentZero;
            filledSubtrees[i] = currentZero;
        }

        // Initialize root with empty tree root
        roots[0] = _hashPair(zeros[MERKLE_TREE_HEIGHT - 1], zeros[MERKLE_TREE_HEIGHT - 1]);
    }

    // ============ Deposit Function ============
    /**
     * @notice Deposit funds into the mixer
     * @param _commitment The commitment = poseidon(nullifier, secret)
     */
    function deposit(bytes32 _commitment) external payable nonReentrant {
        require(msg.value == DENOMINATION, "Invalid deposit amount");
        require(!commitments[_commitment], "Commitment already exists");
        require(nextLeafIndex < 2**MERKLE_TREE_HEIGHT, "Merkle tree full");

        // Insert commitment into Merkle tree
        uint32 leafIndex = nextLeafIndex;
        bytes32 currentHash = _commitment;
        uint32 currentIndex = leafIndex;

        for (uint32 i = 0; i < MERKLE_TREE_HEIGHT; i++) {
            if (currentIndex % 2 == 0) {
                // Left child: store current hash for later, pair with zero
                filledSubtrees[i] = currentHash;
                currentHash = _hashPair(currentHash, zeros[i]);
            } else {
                // Right child: pair with stored left sibling
                currentHash = _hashPair(filledSubtrees[i], currentHash);
            }
            currentIndex /= 2;
        }

        // Update root history (circular buffer)
        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentHash;

        commitments[_commitment] = true;
        nextLeafIndex++;

        emit Deposit(_commitment, leafIndex, block.timestamp);
    }

    // ============ Withdraw Function ============
    /**
     * @notice Withdraw funds from the mixer with ZK proof
     * @param _proof The ZK proof bytes
     * @param _root The Merkle root being proven against
     * @param _nullifierHash Hash of the nullifier (prevents double-spend)
     * @param _recipient Address to receive funds
     * @param _relayer Address to receive fee (0 if none)
     * @param _fee Fee amount for relayer
     */
    function withdraw(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee
    ) external nonReentrant {
        require(!nullifierHashes[_nullifierHash], "Already withdrawn");
        require(isKnownRoot(_root), "Unknown Merkle root");
        require(_fee <= DENOMINATION, "Fee exceeds denomination");
        require(_recipient != address(0), "Invalid recipient");

        // Verify ZK proof
        require(_verifyProof(_proof, _root, _nullifierHash, _recipient, _relayer, _fee), "Invalid proof");

        // Mark nullifier as spent
        nullifierHashes[_nullifierHash] = true;

        // Transfer funds
        uint256 amount = DENOMINATION - _fee;

        (bool success, ) = _recipient.call{value: amount}("");
        require(success, "Transfer to recipient failed");

        if (_fee > 0 && _relayer != address(0)) {
            (bool feeSuccess, ) = _relayer.call{value: _fee}("");
            require(feeSuccess, "Transfer to relayer failed");
        }

        emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);
    }

    // ============ View Functions ============

    /**
     * @notice Check if a root is in the recent root history
     */
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        if (_root == bytes32(0)) return false;

        uint32 i = currentRootIndex;
        do {
            if (roots[i] == _root) return true;
            if (i == 0) {
                i = ROOT_HISTORY_SIZE - 1;
            } else {
                i--;
            }
        } while (i != currentRootIndex);

        return false;
    }

    /**
     * @notice Get the current Merkle root
     */
    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }

    /**
     * @notice Get deposit count
     */
    function getDepositCount() public view returns (uint32) {
        return nextLeafIndex;
    }

    // ============ Internal Functions ============

    /**
     * @notice Hash two values using keccak256 (placeholder for Poseidon)
     * @dev In production, this should use Poseidon hash for ZK compatibility
     */
    function _hashPair(bytes32 _left, bytes32 _right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_left, _right));
    }

    /**
     * @notice Verify the ZK proof
     * @dev This is a placeholder - in production, call the actual verifier contract
     */
    function _verifyProof(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address _recipient,
        address _relayer,
        uint256 _fee
    ) internal view returns (bool) {
        // For MVP: Accept proofs with minimum length check
        // TODO: Integrate actual Noir/Barretenberg verifier

        // Proof must have data
        if (_proof.length < 32) return false;

        // Verify proof structure matches expected format
        // The proof should commit to: root, nullifierHash, recipient, relayer, fee
        bytes32 proofHash = keccak256(_proof);
        bytes32 expectedBinding = keccak256(abi.encodePacked(
            _root,
            _nullifierHash,
            _recipient,
            _relayer,
            _fee
        ));

        // Check first 32 bytes of proof contain binding
        bytes32 proofBinding;
        assembly {
            proofBinding := calldataload(_proof.offset)
        }

        // For MVP: Accept if binding matches
        // In production: Call verifier.verify(proof, publicInputs)
        return proofBinding == expectedBinding;
    }

    // ============ Emergency Functions ============

    /**
     * @notice Check contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
