// Private Transfer Circuit
// Proves: A valid transfer from sender to recipient WITHOUT revealing identities or amount
//
// Use Case: Kevin sends to Juan, but observers only see:
//   - A valid transfer happened
//   - The transfer hash (for on-chain verification)
//   - That sender had sufficient balance
//
// HIDDEN from observers:
//   - Who is the sender (Kevin)
//   - Who is the recipient (Juan)
//   - The transfer amount
//
// Public Inputs:
//   - transfer_hash: Field (commitment to the transfer, for on-chain tracking)
//   - nullifier: Field (prevents double-spending, derived from sender+nonce)
//   - balance_sufficient: u8 (1 if sender has enough balance, 0 otherwise)
//
// Private Inputs:
//   - sender_address: Field (hashed address of sender - NEVER revealed)
//   - recipient_address: Field (hashed address of recipient - NEVER revealed)
//   - amount: u64 (transfer amount - NEVER revealed)
//   - sender_balance: u64 (sender's current balance - NEVER revealed)
//   - nonce: Field (unique nonce to prevent replay)
//   - sender_secret: Field (secret key for nullifier generation)

fn main(
    // Public inputs (visible to everyone)
    transfer_hash: pub Field,
    nullifier: pub Field,
    balance_sufficient: pub u8,
    // Private inputs (hidden in the proof)
    sender_address: Field,
    recipient_address: Field,
    amount: u64,
    sender_balance: u64,
    nonce: Field,
    sender_secret: Field
) {
    // Constraint 1: Sender address must be valid (non-zero)
    assert(sender_address != 0, "Sender address cannot be zero");

    // Constraint 2: Recipient address must be valid (non-zero)
    assert(recipient_address != 0, "Recipient address cannot be zero");

    // Constraint 3: Sender and recipient must be different
    assert(sender_address != recipient_address, "Cannot transfer to self");

    // Constraint 4: Amount must be positive
    assert(amount > 0, "Amount must be greater than zero");

    // Constraint 5: Verify balance check is correct
    let has_sufficient_balance = sender_balance >= amount;
    let expected_balance_sufficient: u8 = if has_sufficient_balance { 1 } else { 0 };
    assert(balance_sufficient == expected_balance_sufficient, "Balance check mismatch");

    // Constraint 6: Verify the transfer hash is correctly computed
    // transfer_hash = hash(sender, recipient, amount, nonce)
    let computed_hash = compute_transfer_hash(sender_address, recipient_address, amount, nonce);
    assert(transfer_hash == computed_hash, "Transfer hash mismatch");

    // Constraint 7: Verify the nullifier is correctly computed
    // nullifier = hash(sender_secret, nonce) - prevents double-spending
    let computed_nullifier = compute_nullifier(sender_secret, nonce);
    assert(nullifier == computed_nullifier, "Nullifier mismatch");
}

// Compute transfer hash commitment
fn compute_transfer_hash(sender: Field, recipient: Field, amount: u64, nonce: Field) -> Field {
    // Simple hash: combine all inputs
    // In production, use Poseidon or Pedersen hash
    let amount_field = amount as Field;
    sender + recipient * 2 + amount_field * 3 + nonce * 5
}

// Compute nullifier (prevents double-spending)
fn compute_nullifier(secret: Field, nonce: Field) -> Field {
    // Simple nullifier: hash(secret, nonce)
    // In production, use Poseidon hash
    secret * 7 + nonce * 11
}

#[test]
fn test_valid_transfer() {
    // Kevin (sender) sends 100 to Juan (recipient)
    let sender_address = 0x1234; // Kevin's hashed address
    let recipient_address = 0x5678; // Juan's hashed address
    let amount: u64 = 100;
    let sender_balance: u64 = 1000;
    let nonce = 0xABCD;
    let sender_secret = 0xDEADBEEF12345678;

    let transfer_hash = compute_transfer_hash(sender_address, recipient_address, amount, nonce);
    let nullifier = compute_nullifier(sender_secret, nonce);

    main(
        transfer_hash,
        nullifier,
        1, // balance_sufficient = true
        sender_address,
        recipient_address,
        amount,
        sender_balance,
        nonce,
        sender_secret
    );
}

#[test]
fn test_insufficient_balance() {
    // Kevin tries to send more than he has
    let sender_address = 0x1234;
    let recipient_address = 0x5678;
    let amount: u64 = 1000;
    let sender_balance: u64 = 100; // Only has 100, trying to send 1000
    let nonce = 0xABCD;
    let sender_secret = 0xDEADBEEF12345678;

    let transfer_hash = compute_transfer_hash(sender_address, recipient_address, amount, nonce);
    let nullifier = compute_nullifier(sender_secret, nonce);

    main(
        transfer_hash,
        nullifier,
        0, // balance_sufficient = false
        sender_address,
        recipient_address,
        amount,
        sender_balance,
        nonce,
        sender_secret
    );
}

#[test(should_fail_with = "Cannot transfer to self")]
fn test_self_transfer() {
    // Cannot transfer to yourself
    let sender_address = 0x1234;
    let nonce = 0xABCD;
    let sender_secret = 0xDEADBEEF12345678;

    let transfer_hash = compute_transfer_hash(sender_address, sender_address, 100, nonce);
    let nullifier = compute_nullifier(sender_secret, nonce);

    main(
        transfer_hash,
        nullifier,
        1,
        sender_address,
        sender_address, // Same as sender!
        100,
        1000,
        nonce,
        sender_secret
    );
}

#[test(should_fail_with = "Amount must be greater than zero")]
fn test_zero_amount() {
    let sender_address = 0x1234;
    let recipient_address = 0x5678;
    let nonce = 0xABCD;
    let sender_secret = 0xDEADBEEF12345678;

    let transfer_hash = compute_transfer_hash(sender_address, recipient_address, 0, nonce);
    let nullifier = compute_nullifier(sender_secret, nonce);

    main(
        transfer_hash,
        nullifier,
        1,
        sender_address,
        recipient_address,
        0, // Zero amount!
        1000,
        nonce,
        sender_secret
    );
}

#[test(should_fail_with = "Balance check mismatch")]
fn test_fake_balance_claim() {
    // Trying to claim balance is sufficient when it's not
    let sender_address = 0x1234;
    let recipient_address = 0x5678;
    let amount: u64 = 1000;
    let sender_balance: u64 = 100; // Not enough!
    let nonce = 0xABCD;
    let sender_secret = 0xDEADBEEF12345678;

    let transfer_hash = compute_transfer_hash(sender_address, recipient_address, amount, nonce);
    let nullifier = compute_nullifier(sender_secret, nonce);

    main(
        transfer_hash,
        nullifier,
        1, // Claiming balance is sufficient - LIE!
        sender_address,
        recipient_address,
        amount,
        sender_balance,
        nonce,
        sender_secret
    );
}
