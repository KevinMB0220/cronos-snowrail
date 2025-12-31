# 🚀 Cronos x402 E2E Demo Walkthrough

Complete end-to-end demonstration of the Agentic Treasury system from payment intent creation to on-chain settlement.

## 📋 Prerequisites

Before running the E2E demo, ensure:

- Backend server running on port 3001
- Frontend running on port 3000
- MetaMask or wallet extension installed
- Testnet CRO for gas fees in backend wallet
- System is ready: `curl http://localhost:3001/health/ready`

## 🔄 E2E Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CREATE INTENT                                                │
│    POST /api/intents                                            │
│    └─> Frontend or API creates payment intent                   │
│    └─> Backend automatically evaluates with AI Agent            │
│    └─> Returns: intentId + agentDecision                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. EXECUTE INTENT                                               │
│    POST /api/intents/{intentId}/execute                         │
│    └─> Re-evaluate intent with Agent                            │
│    └─> If EXECUTE: Sign with backend wallet                     │
│    └─> Orchestrator generates transaction hash                  │
│    └─> Update intent status to "executed"                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. VERIFY STATUS                                                │
│    GET /api/intents/{intentId}                                  │
│    └─> Retrieve final intent state                              │
│    └─> Confirm status: "executed" or "pending"                  │
│    └─> View transaction hash                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🧪 Demo Script (2-3 minutes)

### Step 1: Verify System Ready

```bash
# Check system health and readiness
curl http://localhost:3001/health/ready

# Expected response shows:
# - All services initialized
# - Available endpoints
# - Network and chain ID
```

### Step 2: Create Payment Intent

```bash
# Create a new payment intent
INTENT_RESPONSE=$(curl -X POST http://localhost:3001/api/intents \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "0.1",
    "currency": "CRO",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "condition": {
      "type": "manual",
      "value": "demo"
    }
  }')

echo $INTENT_RESPONSE | jq '.'

# Extract intentId from response
INTENT_ID=$(echo $INTENT_RESPONSE | jq -r '.data.intentId')
echo "Intent ID: $INTENT_ID"
```

**Key Points:**
- `condition.type: "manual"` ensures Agent always approves (for demo)
- `condition.type: "price-below"` evaluates real market condition
- Response includes agentDecision (EXECUTE or SKIP)
- Status is automatically "pending"

### Step 3: Execute Intent

```bash
# Trigger orchestration and execution
EXECUTE_RESPONSE=$(curl -X POST http://localhost:3001/api/intents/$INTENT_ID/execute \
  -H "Content-Type: application/json")

echo $EXECUTE_RESPONSE | jq '.'

# Response will show:
# - New status: "executed" if successful, "pending" if agent said SKIP
# - txHash: Generated transaction hash
# - agentDecision: Re-evaluation result
```

**What Happens Behind the Scenes:**
1. Intent status validated (not already executed)
2. Agent re-evaluates the condition
3. If EXECUTE: Backend wallet signs the intent
4. Orchestrator generates signature and txHash
5. Intent status updated to "executed"
6. Frontend notified via status endpoint

### Step 4: Verify Final Status

```bash
# Retrieve the final intent state
curl http://localhost:3001/api/intents/$INTENT_ID | jq '.'

# Confirm:
# - status: "executed"
# - txHash: Present and valid format
# - All original data intact
```

### Step 5: Test Error Cases (Optional)

```bash
# Try to re-execute same intent (should fail with 409)
curl -X POST http://localhost:3001/api/intents/$INTENT_ID/execute

# Expected: INTENT_ALREADY_COMPLETED error

# Try non-existent intent (should fail with 404)
curl http://localhost:3001/api/intents/invalid-id

# Expected: INTENT_NOT_FOUND error
```

## 📊 Demo Highlights

| Step | Action | Expected | Time |
|------|--------|----------|------|
| 1 | Check /health/ready | All services ✅ | <100ms |
| 2 | POST /api/intents | intentId + decision | <500ms |
| 3 | POST /api/intents/:id/execute | txHash generated | <1s |
| 4 | GET /api/intents/:id | Final status | <100ms |
| 5 | Error handling | Proper HTTP codes | <100ms |

## 🔑 Key Features to Highlight

1. **Autonomous AI Agent**
   - Automatically evaluates conditions
   - Makes execution decisions
   - Re-evaluates on demand

2. **Wallet Security**
   - Backend wallet signs intents
   - EIP-191 signature format
   - Replay protection (chainId + nonce)

3. **State Management**
   - Prevents re-execution of completed intents
   - Tracks intent status throughout lifecycle
   - Proper HTTP status codes (200, 202, 409, etc.)

4. **Transparency**
   - All operations logged
   - Transaction hashes provided
   - Complete state visibility

## 📝 Response Format Example

```json
{
  "status": "success",
  "code": "INTENT_EXECUTED",
  "message": "Payment intent executed successfully",
  "data": {
    "intentId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": "0.1",
    "currency": "CRO",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "condition": {
      "type": "manual",
      "value": "demo"
    },
    "status": "executed",
    "createdAt": "2025-12-31T23:59:59.000Z",
    "txHash": "0x...",
    "agentDecision": {
      "decision": "EXECUTE",
      "reason": "Manual condition met for demo"
    }
  }
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend not responding | Check `npm run dev` is running on port 3001 |
| PRIVATE_KEY error | Verify .env has valid PRIVATE_KEY |
| Intent not found | Check intentId is correct (copy from Step 2) |
| Re-execute fails with 409 | This is expected! Intents can only execute once |
| Agent always skips | Use `condition.type: "manual"` for guaranteed execution |

## 🎯 Next Steps

After successful E2E demo:

1. **Issue #9**: Implement real RPC broadcasting to Cronos network
2. **Issue #15**: Add real transaction confirmation and tracking
3. **Issue #16**: Implement full authentication and authorization
4. **Hackathon**: Package for submission with video demo

## 📚 Additional Resources

- [Architecture](./docs/ARCHITECTURE.md) - System design overview
- [API Standards](./docs/API_STANDARDS.md) - Response format specification
- [Security](./docs/SECURITY.md) - Security considerations

---

**Ready for demo? Start with Step 1 and follow the flow!** 🚀
