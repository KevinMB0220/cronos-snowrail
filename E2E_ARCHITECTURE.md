# Snow Rail - E2E System Architecture

## 🏗️ Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          END-TO-END FLOW DIAGRAM                            │
└─────────────────────────────────────────────────────────────────────────────┘

USER (MetaMask Wallet)
       │
       │ 1. Connect Wallet
       ↓
┌──────────────────────────────────────┐
│  FRONTEND (Next.js 14, Port 3000)   │
│  ├── Hero Section                   │
│  ├── Dashboard (/dashboard)         │
│  ├── CreateIntentForm               │
│  ├── IntentList                     │
│  └── TriggerAgentButton             │
└──────────────────────────────────────┘
       │
       │ 2. Create Intent / Trigger Agent
       │ (API calls to Backend)
       ↓
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (Fastify, Port 4000)                               │
│  ├── Intent Routes                                          │
│  │   ├── POST /api/intents          (Create)              │
│  │   ├── GET /api/intents            (List)               │
│  │   └── GET /api/intents/:id        (Get One)            │
│  ├── Agent Routes                                           │
│  │   └── POST /api/agent/trigger     (Trigger Agent)      │
│  ├── Services                                               │
│  │   ├── IntentService               (Store & Manage)     │
│  │   ├── AgentService                (AI Logic)           │
│  │   ├── WalletService               (Key Management)     │
│  │   └── Orchestrator                (x402 Execution)     │
│  └── Health Endpoints                                       │
│      ├── GET /health                                        │
│      └── GET /health/ready                                  │
└──────────────────────────────────────────────────────────────┘
       │
       │ 3. Agent Evaluates Intent
       │ 4. Sign Transaction
       │ 5. Execute on Blockchain
       ↓
┌──────────────────────────────────────┐
│  BLOCKCHAIN (Cronos Testnet)         │
│  ├── Settlement Contract             │
│  │   └── executeSettlement()         │
│  ├── Chain ID: 338                   │
│  └── RPC: Cronos Testnet             │
└──────────────────────────────────────┘
       │
       │ 6. Transaction Confirmed
       │ 7. Return TX Hash to Backend
       ↓
┌──────────────────────────────────────┐
│  BACKEND (Update Intent Status)      │
│  └── Update Status: EXECUTED         │
└──────────────────────────────────────┘
       │
       │ 8. Return Response to Frontend
       ↓
┌──────────────────────────────────────┐
│  FRONTEND (Display Results)          │
│  ├── Update Intent Status            │
│  ├── Show TX Hash                    │
│  └── Link to Cronoscan               │
└──────────────────────────────────────┘
       │
       │ 9. User Verifies on Cronoscan
       ↓
┌──────────────────────────────────────┐
│  CRONOSCAN (Block Explorer)          │
│  ├── View Transaction                │
│  ├── Confirm Execution               │
│  └── Verify Recipient Received Funds │
└──────────────────────────────────────┘
```

---

## 🔄 API Integration Points

### 1. Create Intent
```
Frontend → POST /api/intents
{
  amount: string
  currency: string
  recipient: string
  condition: {
    type: 'manual' | 'price-below'
    value: string
  }
}
↓
Backend → Returns PaymentIntent
{
  intentId: string
  status: 'pending'
  createdAt: string
  ...
}
```

### 2. List Intents
```
Frontend → GET /api/intents
↓
Backend → Returns PaymentIntent[]
```

### 3. Trigger Agent
```
Frontend → POST /api/agent/trigger
{
  intentId: string
}
↓
Backend:
  1. Load intent
  2. Evaluate with AI Agent
  3. If approved: execute transaction
  4. Update intent status
  5. Return result
↓
Response:
{
  status: 'success' | 'warning' | 'error'
  message: string
  data: {
    intentId: string
    status: 'executed' | 'pending'
    txHash?: string
    agentDecision: {
      decision: 'EXECUTE' | 'SKIP'
      reason: string
    }
  }
}
```

---

## 🔐 Security Flow

```
1. Frontend Connection
   └─ MetaMask provides user pubkey
   └─ No private keys sent to backend

2. Intent Creation
   └─ User-signed intent metadata
   └─ Backend validates

3. Agent Execution
   └─ Backend wallet (non-custodial)
   └─ Signs transactions autonomously
   └─ All on-chain records

4. Settlement
   └─ Smart contract enforces rules
   └─ Recipient specified in contract
   └─ Immutable on blockchain
```

---

## 📊 Data Flow During E2E Test

### Timeline

```
T+0s:  User clicks "Create Intent"
       └─ Frontend: Form submitted
       └─ Backend: POST /api/intents

T+0.5s: Backend receives & processes
        └─ Validates fields
        └─ Stores in memory
        └─ Returns intentId

T+0.6s: Frontend receives response
        └─ Displays success message
        └─ Adds to intent list
        └─ Auto-refresh starts

T+1s:   User clicks "Trigger Agent"
        └─ Frontend: POST /api/agent/trigger
        └─ Backend: Loading...

T+1.5s: Agent evaluates
        └─ Checks conditions
        └─ Makes decision
        └─ Logs reasoning

T+2s:   If EXECUTE decision:
        └─ Sign transaction
        └─ Send to blockchain
        └─ Wait for confirmation

T+3-4s: Transaction confirmed
        └─ Update status to EXECUTED
        └─ Store txHash
        └─ Return to frontend

T+4.5s: Frontend receives response
        └─ Display txHash
        └─ Link to Cronoscan
        └─ Update status

T+5s:   Demo complete! ✅
```

---

## 🎯 Validation Checkpoints

During E2E test, verify:

| Checkpoint | Expected Result |
|-----------|-----------------|
| Frontend Loads | No console errors |
| Wallet Connects | Address displayed |
| Intent Creates | Success message, intent in list |
| Agent Triggers | Response within 3 seconds |
| Decision Made | EXECUTE or SKIP logged |
| TX Executed | txHash returned |
| Status Updates | "EXECUTED" shown |
| Cronoscan Shows | TX confirmed on-chain |
| Backend Logs | Tracing IDs present |

---

## 🐛 Common Issues & Root Causes

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 on API calls | Backend port wrong | Check .env: `NEXT_PUBLIC_API_URL=http://localhost:4000` |
| Wallet won't connect | Chain mismatch | Switch to Cronos Testnet (338) in MetaMask |
| Agent always skips | Conditions not met | Use "Manual" trigger or valid price condition |
| TX fails | No gas | Ensure wallet has testnet CRO |
| Status doesn't update | Auto-refresh off | Manually refresh frontend or check interval |
| CORS errors | Frontend origin not allowed | Check backend CORS config (allows 3000/3001) |

---

## ✅ Success Criteria Checklist

- [ ] Backend health endpoint responds (port 4000)
- [ ] Frontend loads without errors (port 3000/3001)
- [ ] Wallet connects to MetaMask
- [ ] MetaMask shows Cronos Testnet (Chain ID 338)
- [ ] Can create payment intent
- [ ] Intent appears in list with "PENDING" status
- [ ] Can click "Trigger Agent"
- [ ] Agent responds within 3 seconds
- [ ] If EXECUTE: txHash is displayed and clickable
- [ ] If SKIP: reason is displayed
- [ ] Intent status updates to "EXECUTED" (if executed)
- [ ] Transaction visible on Cronoscan
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] Response times are reasonable (<5 seconds total)

---

## 📚 Reference Files

- [Complete Demo Guide](./DEMO.md)
- [Backend Implementation](./apps/backend/README.md)
- [Frontend Implementation](./apps/frontend/README.md)
- [System Architecture](./docs/ARCHITECTURE.md)
- [API Standards](./docs/API_STANDARDS.md)

---

**This E2E architecture ensures complete system integration from user action to on-chain settlement.** ✅
