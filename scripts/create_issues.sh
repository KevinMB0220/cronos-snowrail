#!/bin/bash

# Cronos x402 Agentic Treasury - Issue Creation Script
# Requires: gh (GitHub CLI) installed and authenticated

echo "🚀 Creating GitHub Issues for Cronos x402 Agentic Treasury..."

# 1. Smart Contract: Core Logic
gh issue create \
  --title "feat(contracts): Implement Settlement Core Logic & Security" \
  --body "Implement the core logic in \`Settlement.sol\`.

**Requirements:**
- The \`executeSettlement\` function must verify that the \`intentHash\` is signed by the authorized backend wallet (Agent).
- Use ECDSA \`recover\` to validate signatures.
- Ensure reentrancy protection (though strictly Checks-Effects-Interactions might suffice for simple transfers).
- Emit structured events (\`PaymentExecuted\`, \`PaymentFailed\`) for indexing.

**Acceptance Criteria:**
- Contract compiles without warnings.
- Unit tests pass covering: authorized signature, invalid signature, insufficient balance.
- Gas usage is optimized." \
  --label "contracts" --label "security"

# 2. Smart Contract: Deploy Pipeline
gh issue create \
  --title "ops(contracts): Deployment & Verification Pipeline" \
  --body "Create a robust deployment workflow for Cronos Testnet.

**Requirements:**
- Update \`hardhat.config.ts\` with proper network settings.
- Create a deployment script that:
  - Deploys \`Settlement.sol\`.
  - Verifies the contract source code on Cronoscan immediately after deploy.
  - Saves the deployed address to \`apps/backend/.env\` (or prints it clearly).

**Acceptance Criteria:**
- \`npm run deploy:testnet\` works flawlessly.
- Contract appears verified on the explorer." \
  --label "contracts" --label "devops"

# 3. Backend: Intent Management
gh issue create \
  --title "feat(backend): Payment Intent Storage & API" \
  --body "Implement the CRUD API for Payment Intents in the Unified Backend.

**Requirements:**
- In-memory storage (Map) is acceptable for MVP, but interface it properly (Repository pattern).
- \`POST /intents\`: Validate body using standard schema.
- \`GET /intents\`: List all intents with their status.
- Ensure types match \`@cronos-x402/shared-types\`.

**Acceptance Criteria:**
- Curl/Postman tests confirm intents can be created and retrieved.
- Validation errors return 400 with standard Error response format." \
  --label "backend" --label "api"

# 4. Backend: AI Agent Engine
gh issue create \
  --title "feat(backend): AI Agent Decision Engine" \
  --body "Implement the 'Brain' of the system in \`src/agent/agent.ts\`.

**Requirements:**
- The \`evaluate(intent)\` function must be deterministic.
- Support \`condition: { type: 'price-below', value: '...' }\`.
- Fetch real (or mock) price data for the evaluation.
- Return a clear \`AgentDecision\` object (EXECUTE | SKIP) with a reason.
- **Strictly**: The agent DOES NOT sign transactions here. It only decides.

**Acceptance Criteria:**
- Unit tests for the Agent class covering both decision outcomes.
- Logs clearly show the reasoning step-by-step." \
  --label "backend" --label "ai-agent"

# 5. Backend: x402 Orchestrator
gh issue create \
  --title "feat(backend): x402 Orchestrator Integration" \
  --body "Implement the execution layer that bridges the Agent's decision to the Blockchain.

**Requirements:**
- Receive a positive decision from the Agent.
- Construct the transaction payload for \`Settlement.executeSettlement\`.
- Sign the transaction using the Backend's private key (The 'Agent' Wallet).
- Broadcast to Cronos Testnet via RPC.
- Handle nonces and gas estimation properly.

**Acceptance Criteria:**
- A triggered intent results in a valid tx hash.
- The tx actually calls the contract successfully." \
  --label "backend" --label "blockchain"

# 6. Frontend: Wallet & Context
gh issue create \
  --title "feat(frontend): Wallet Integration & State" \
  --body "Setup the Web3 foundations for the Frontend.

**Requirements:**
- Integrate RainbowKit + Wagmi.
- Configure Cronos Testnet chain.
- Create a global \`IntentContext\` or standard React Query hooks to fetch intents from the Backend API.

**Acceptance Criteria:**
- User can connect/disconnect wallet.
- App displays user address and balance.
- Intents are fetched from the backend and displayed in a raw list." \
  --label "frontend" --label "web3"

# 7. Frontend: UI Components
gh issue create \
  --title "feat(frontend): Dashboard & Creation UI" \
  --body "Build the main user interface for the Agentic Treasury.

**Requirements:**
- **Create Form**: Inputs for Amount, Recipient, Condition (Price).
- **Dashboard**: List of active intents with status badges (Pending, Executed).
- **Trigger Button**: A prominent button to manually trigger the Agent (for demo purposes).

**Acceptance Criteria:**
- UI is clean, uses TailwindCSS, and matches the 'Cyber/Hacker' aesthetic.
- Form submits correctly to the backend." \
  --label "frontend" --label "ui"

# 8. E2E: Full Integration
gh issue create \
  --title "test(e2e): Full System Integration & Demo Prep" \
  --body "Connect all pieces and verify the End-to-End flow.

**Steps:**
1. Frontend: User connects wallet & creates Intent (Price < X).
2. Backend: API receives Intent.
3. Frontend: User clicks 'Trigger Agent'.
4. Backend: Agent evaluates -> True.
5. Backend: Orchestrator signs & sends Tx.
6. Chain: Settlement executes transfer.
7. Frontend: UI updates with Tx Hash.

**Acceptance Criteria:**
- A video recording or screenshot sequence of this entire flow working." \
  --label "testing" --label "release"

echo "✅ All issues created successfully!"

