// Price Condition Circuit
// Proves: currentPrice < threshold WITHOUT revealing threshold
//
// Use Case: AI Agent proves price condition is met without exposing
// the exact threshold to observers
//
// Public Inputs:
//   - current_price: u64 (price * 1e8, e.g., 0.10 USD = 10_000_000)
//   - intent_id_hash: Field (keccak256 of intentId, prevents replay)
//   - condition_met: u8 (1 if condition is true, 0 otherwise)
//
// Private Inputs:
//   - threshold: u64 (price threshold * 1e8, NEVER revealed)

fn main(
    // Public inputs (visible to everyone)
    current_price: pub u64,
    intent_id_hash: pub Field,
    condition_met: pub u8,
    // Private inputs (hidden in the proof)
    threshold: u64
) {
    // Constraint 1: Threshold must be positive (prevent zero threshold attacks)
    // Check this FIRST before any computation with threshold
    assert(threshold > 0, "Threshold must be greater than zero");

    // Constraint 2: Intent ID hash must be non-zero (binding to specific intent)
    assert(intent_id_hash != 0, "Intent ID hash cannot be zero");

    // Constraint 3: Current price must be reasonable (< 1 trillion USD in 1e8)
    assert(current_price < 100_000_000_000_000_000, "Price exceeds maximum");

    // Constraint 4: Verify the condition_met flag is correct
    // The prover claims condition_met, we verify it matches reality
    let price_is_below = current_price < threshold;

    // Convert bool to u8 for comparison
    let expected_met: u8 = if price_is_below { 1 } else { 0 };

    // Assert the public condition_met matches the actual computation
    assert(condition_met == expected_met, "Condition flag does not match price comparison");
}

#[test]
fn test_price_below_threshold() {
    // Current price: 0.08 USD (8_000_000 in 1e8)
    // Threshold: 0.10 USD (10_000_000 in 1e8)
    // Expected: condition_met = 1 (price IS below threshold)

    main(
        8_000_000,                          // current_price
        0x1234567890abcdef1234567890abcdef, // intent_id_hash
        1,                                   // condition_met (true)
        10_000_000                           // threshold (private)
    );
}

#[test]
fn test_price_above_threshold() {
    // Current price: 0.12 USD (12_000_000)
    // Threshold: 0.10 USD (10_000_000)
    // Expected: condition_met = 0 (price is NOT below threshold)

    main(
        12_000_000,                         // current_price
        0x1234567890abcdef1234567890abcdef, // intent_id_hash
        0,                                   // condition_met (false)
        10_000_000                           // threshold (private)
    );
}

#[test]
fn test_price_equal_threshold() {
    // Current price: 0.10 USD (10_000_000)
    // Threshold: 0.10 USD (10_000_000)
    // Expected: condition_met = 0 (NOT below, equal doesn't count)

    main(
        10_000_000,                         // current_price
        0x1234567890abcdef1234567890abcdef, // intent_id_hash
        0,                                   // condition_met (false - not BELOW)
        10_000_000                           // threshold (private)
    );
}

#[test(should_fail_with = "Condition flag does not match price comparison")]
fn test_invalid_condition_flag() {
    // This should fail - claiming condition is met when it's not
    main(
        12_000_000,                         // current_price (ABOVE threshold)
        0x1234567890abcdef1234567890abcdef,
        1,                                   // WRONG: claiming condition met
        10_000_000                           // threshold
    );
}

#[test(should_fail_with = "Threshold must be greater than zero")]
fn test_zero_threshold() {
    // This should fail - zero threshold is invalid
    main(
        1_000_000,
        0x1234567890abcdef1234567890abcdef,
        1,
        0  // Invalid: zero threshold
    );
}

#[test(should_fail_with = "Intent ID hash cannot be zero")]
fn test_zero_intent_hash() {
    // This should fail - zero intent hash allows replay attacks
    main(
        8_000_000,
        0,  // Invalid: zero intent hash
        1,
        10_000_000
    );
}
