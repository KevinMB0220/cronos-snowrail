# Noir ZK Circuits

Zero-knowledge circuits for the Cronos x402 Agentic Treasury.

## Prerequisites

Install Noir:

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup -v 0.36.0
```

Verify installation:

```bash
nargo --version
```

## Available Circuits

### 1. price_condition

Proves that `currentPrice < threshold` WITHOUT revealing the threshold.

**Use Case:** AI Agent can prove a price condition is met without exposing the exact trigger price to observers.

**Public Inputs:**
- `current_price`: Current market price (u64, scaled by 1e8)
- `intent_id_hash`: Hash of intent ID (prevents replay)
- `condition_met`: 1 if condition is true, 0 otherwise

**Private Inputs (NEVER revealed):**
- `threshold`: Price threshold

### 2. private_transfer

Proves a valid transfer WITHOUT revealing sender, recipient, or amount.

**Use Case:** Kevin sends 100 USDC to Juan. Observers can verify:
- ✅ A valid transfer happened
- ✅ Sender had sufficient balance
- ✅ Transfer is unique (not double-spent)

But they CANNOT see:
- ❌ Who sent (Kevin)
- ❌ Who received (Juan)
- ❌ How much (100 USDC)

**Public Inputs:**
- `transfer_hash`: Commitment to the transfer (for on-chain tracking)
- `nullifier`: Prevents double-spending
- `balance_sufficient`: 1 if sender has enough, 0 otherwise

**Private Inputs (NEVER revealed):**
- `sender_address`: Hashed address of sender
- `recipient_address`: Hashed address of recipient
- `amount`: Transfer amount
- `sender_balance`: Sender's current balance
- `nonce`: Unique nonce
- `sender_secret`: Secret key for nullifier

## Usage

### 1. Compile Circuits

```bash
cd circuits/price_condition
nargo compile

cd ../private_transfer
nargo compile
```

### 2. Run Tests

```bash
cd circuits/price_condition
nargo test

cd ../private_transfer
nargo test
```

### 3. Generate Proofs via Backend API

```typescript
import { getZKProofService } from './services/zkproof-service';

const zkService = getZKProofService();

// Price condition proof (threshold hidden)
const priceProof = await zkService.generatePriceConditionProof(
  0.08,           // currentPrice
  0.10,           // threshold (PRIVATE)
  'intent-123'   // intentId
);

// Private transfer proof (sender, recipient, amount hidden)
const transferProof = await zkService.generatePrivateTransferProof(
  'kevin.eth',     // sender (PRIVATE)
  'juan.eth',      // recipient (PRIVATE)
  100,             // amount (PRIVATE)
  1000,            // senderBalance (PRIVATE)
  'my-secret-key'  // senderSecret (PRIVATE)
);
```

## Price Encoding

Prices are encoded as u64 with 8 decimal places:

| Price USD | Encoded Value |
|-----------|---------------|
| $0.08     | 8_000_000     |
| $0.10     | 10_000_000    |
| $1.00     | 100_000_000   |
| $100.00   | 10_000_000_000|

## Security Considerations

### price_condition
1. **Never log the threshold** - it's the private input
2. **Intent ID hash prevents replay** - each proof is bound to specific intent
3. **Threshold > 0 check** - prevents zero threshold attacks
4. **Price bounds check** - prevents overflow attacks

### private_transfer
1. **Never log sender, recipient, or amount** - all are private
2. **Nullifier prevents double-spending** - same transfer can't be used twice
3. **Balance check is enforced** - can't fake having sufficient balance
4. **Self-transfer blocked** - sender != recipient
5. **Zero amount blocked** - amount must be positive

## Files

```
circuits/
├── README.md
├── price_condition/
│   ├── Nargo.toml
│   ├── src/
│   │   └── main.nr
│   └── target/
│       └── price_condition.json
└── private_transfer/
    ├── Nargo.toml
    ├── src/
    │   └── main.nr
    └── target/
        └── private_transfer.json
```
