# Snow Rail - E2E Demo & Testing Guide

## 🚀 Quick Start

### Prerequisites

Before starting the demo, ensure you have:

1. **Backend running** on port 4000
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Frontend running** on port 3000 or 3001
   ```bash
   cd apps/frontend
   npm run dev
   ```

3. **MetaMask wallet** installed with testnet CRO
4. **Cronos Testnet** configured in MetaMask (Chain ID: 338)

---

## 📋 Complete E2E Flow (5 minutes)

### Step 1: Connect Your Wallet

1. Open http://localhost:3000 (or 3001)
2. Click **"Connect Wallet"** button (top right)
3. Select **MetaMask**
4. Approve the connection in your wallet
5. Verify wallet address displays in navbar
6. Verify you're on **Cronos Testnet (Chain ID 338)**

**Expected Result:**
- Wallet address visible in navbar
- Network shows "Cronos Testnet"

---

### Step 2: Navigate to Agent Dashboard

1. Click **"Launch Agent"** button on hero section
2. You should see the dashboard with:
   - "Create Payment Intent" form
   - "Payment Intents" list (empty initially)

**Expected Result:**
- Form is ready to fill
- UI is responsive and loads without errors

---

### Step 3: Create a Payment Intent

Fill out the form with these values:

```
Amount: 0.1
Currency: WCRO
Recipient: 0x22f6F000609d52A0b0efCD4349222cd9d70716Ba
Execution Condition: Manual Trigger
```

Click **"Create Intent"**

**Expected Result:**
- Green success message appears
- Intent appears in the list with status "PENDING"
- Form clears

---

### Step 4: Trigger the Agent

1. Find the intent in the list
2. Click **"Trigger Agent"** button
3. Wait for loading indicator
4. You should see:

**Success:**
```
✅ Success! Transaction executed:
0xabcd1234...
```

**Or Skip:**
```
⚠️ Agent Decision:
Agent skipped this intent based on current conditions
```

---

### Step 5: Verify On-Chain

1. Click the transaction hash link
2. Verify on **Cronoscan Testnet**:
   - ✅ Transaction status: Success
   - ✅ Recipient received funds
3. Return to frontend - status should show "EXECUTED"

---

## 🔍 Demo Checklist

- [ ] Frontend loads on port 3000/3001
- [ ] Backend running on port 4000
- [ ] Wallet connects successfully
- [ ] Chain is Cronos Testnet (338)
- [ ] Payment intent creates
- [ ] Agent trigger responds
- [ ] Transaction on Cronoscan
- [ ] Intent status updates
- [ ] No console errors

---

## 🐛 Troubleshooting

### Frontend not connecting to backend

```bash
# Check backend health
curl http://localhost:4000/health
```

### MetaMask connection fails

1. Install MetaMask
2. Switch to Cronos Testnet (Chain ID 338)
3. Ensure wallet has testnet CRO for gas

### Agent always skips

- Use "Manual" trigger condition
- Verify recipient address is valid
- Check backend logs for reasoning

### Transaction fails

- Ensure backend wallet has CRO for gas
- Settlement contract has CRO deposited
- Check contract addresses in .env

---

## 📚 Documentation

- [System Architecture](./docs/ARCHITECTURE.md)
- [Backend Setup](./apps/backend/README.md)
- [Frontend Setup](./apps/frontend/README.md)

**Good luck with your demo! 🚀**
