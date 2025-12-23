#!/bin/bash

# Cronos x402 Agentic Treasury - Issue Creation Script
# Requires: gh (GitHub CLI) installed and authenticated

echo "🚀 Creating GitHub Issues for Cronos x402 Agentic Treasury..."
echo "ℹ️  Refer to 'docs/' for standards and architecture context in all issues."

# Create labels first (ignore errors if they already exist)
echo "📋 Creating labels..."
gh label create "contracts" --description "Smart contract related" --color "0E8A16" --force 2>/dev/null || true
gh label create "backend" --description "Backend server code" --color "0052CC" --force 2>/dev/null || true
gh label create "frontend" --description "Frontend/client code" --color "1D76DB" --force 2>/dev/null || true
gh label create "chore" --description "Maintenance tasks" --color "EEEEEE" --force 2>/dev/null || true
gh label create "security" --description "Security improvements" --color "D93F0B" --force 2>/dev/null || true
gh label create "devops" --description "DevOps and deployment" --color "5319E7" --force 2>/dev/null || true
gh label create "api" --description "API endpoints" --color "FBCA04" --force 2>/dev/null || true
gh label create "ai" --description "AI Agent logic" --color "BFD4F2" --force 2>/dev/null || true
gh label create "core" --description "Core functionality" --color "E99695" --force 2>/dev/null || true
gh label create "web3" --description "Web3/blockchain integration" --color "C5DEF5" --force 2>/dev/null || true
gh label create "ui" --description "User interface" --color "FEF2C0" --force 2>/dev/null || true
gh label create "testing" --description "Tests and QA" --color "D4C5F9" --force 2>/dev/null || true
gh label create "release" --description "Release preparation" --color "0E8A16" --force 2>/dev/null || true

echo "✅ Labels ready. Creating issues..."
echo ""

# --- FASE 1: SMART CONTRACTS ---

# 1. Setup
gh issue create \
  --title "chore(contracts): Setup Hardhat & Network Config" \
  --body "Initialize the Hardhat environment for Cronos Testnet.

**Context:**
- Refer to \`docs/ARCHITECTURE.md\` for the role of the Settlement contract.
- Refer to \`docs/NAMING_STANDARDS.md\` for file naming.

**Tasks:**
- [ ] Install Hardhat dependencies (\`npm install\` in contracts folder).
- [ ] Configure \`hardhat.config.ts\` with Cronos Testnet RPC and Chain ID (338).
- [ ] Ensure \`.env\` is loaded correctly (use \`dotenv\`).

**Acceptance Criteria:**
- \`npx hardhat compile\` runs successfully.
- \`npx hardhat test\` runs the default test." \
  --label "contracts" --label "chore"

# 2. Basic Settlement
gh issue create \
  --title "feat(contracts): Implement Basic Transfer Logic" \
  --body "Implement the basic transfer functionality in \`Settlement.sol\`.

**Context:**
- The contract holds funds and releases them.

**Tasks:**
- [ ] Create \`receive() external payable\` to accept deposits.
- [ ] Implement \`executeSettlement\` that transfers native CRO to a recipient.
- [ ] Add \`InsufficientBalance\` error check.

**Acceptance Criteria:**
- Contract accepts deposits.
- Contract can transfer funds to an address." \
  --label "contracts"

# 3. Security
gh issue create \
  --title "feat(contracts): Implement Signature Verification" \
  --body "Secure the \`executeSettlement\` function with ECDSA signature verification.

**Context:**
- Only the AI Agent (Backend) should be able to authorize a settlement.
- See \`docs/ARCHITECTURE.md\`.

**Tasks:**
- [ ] Add \`intentHash\` and \`signature\` parameters to \`executeSettlement\`.
- [ ] Use \`ECDSA.recover\` to verify the signer is the authorized \`owner\` or \`executor\`.
- [ ] Prevent replay attacks (store executed intent hashes).

**Acceptance Criteria:**
- Function reverts if signature is invalid.
- Function reverts if intent was already executed." \
  --label "contracts" --label "security"

# 4. Deploy Script
gh issue create \
  --title "ops(contracts): Deploy & Verify Script" \
  --body "Create a script to deploy and verify the contract on Cronos Testnet.

**Tasks:**
- [ ] Write \`scripts/deploy.ts\`.
- [ ] Include Etherscan verification plugin in config.
- [ ] Log the deployed address clearly.

**Acceptance Criteria:**
- \`npm run deploy:testnet\` deploys the contract.
- Contract source is verified on Cronos Explorer." \
  --label "contracts" --label "devops"


# --- FASE 2: BACKEND ---

# 5. Server Setup
gh issue create \
  --title "chore(backend): Fastify Server & Types Setup" \
  --body "Configure the Fastify server foundation.

**Context:**
- See \`apps/backend/src/index.ts\`.
- Adhere to \`docs/API_STANDARDS.md\`.

**Tasks:**
- [ ] Setup Fastify with CORS and Helmet.
- [ ] Ensure \`@cronos-x402/shared-types\` is linked and usable.
- [ ] Create the folder structure: \`routes/\`, \`controllers/\`, \`services/\`.

**Acceptance Criteria:**
- Server starts on port 3001.
- \`GET /health\` returns 200 OK." \
  --label "backend" --label "chore"

# 6. Intent CRUD
gh issue create \
  --title "feat(backend): Payment Intent CRUD API" \
  --body "Implement API to create and list Payment Intents.

**Context:**
- Follow \`docs/API_STANDARDS.md\` for response format.

**Tasks:**
- [ ] Create \`POST /intents\` endpoint.
- [ ] Validate body (amount, currency, condition).
- [ ] Store in-memory (Map<string, PaymentIntent>).
- [ ] Create \`GET /intents\` endpoint.

**Acceptance Criteria:**
- Created intent has \`status: 'pending'\`.
- API returns standard JSON success/error responses." \
  --label "backend" --label "api"

# 7. Agent Logic
gh issue create \
  --title "feat(backend): AI Agent Decision Logic" \
  --body "Implement the evaluation logic in \`src/agent/agent.ts\`.

**Context:**
- The Agent decides *IF* a payment should happen.

**Tasks:**
- [ ] Implement \`evaluate(intent: PaymentIntent): Promise<AgentDecision>\`.
- [ ] Handle \`condition.type === 'price-below'\`.
- [ ] Mock or fetch a real price (e.g. CRO/USD).
- [ ] Return \`EXECUTE\` if condition met, \`SKIP\` if not.

**Acceptance Criteria:**
- Unit tests cover both True and False outcomes." \
  --label "backend" --label "ai"

# 8. Wallet Manager
gh issue create \
  --title "feat(backend): Backend Wallet & Signing" \
  --body "Implement the wallet management for the backend to sign transactions.

**Context:**
- The backend needs a private key to authorize settlements.

**Tasks:**
- [ ] Load \`PRIVATE_KEY\` from env.
- [ ] Initialize Ethers Wallet instance.
- [ ] Implement a helper \`signMessage(hash)\`.

**Acceptance Criteria:**
- Backend can produce valid signatures for a given hash." \
  --label "backend" --label "security"

# 9. Orchestrator
gh issue create \
  --title "feat(backend): Connect Agent to Blockchain (Orchestrator)" \
  --body "Wire up the Agent decision to the Contract execution.

**Context:**
- See \`docs/ARCHITECTURE.md\` (Orchestrator).

**Tasks:**
- [ ] Create \`POST /agent/trigger\` endpoint.
- [ ] If Agent returns \`EXECUTE\`:
  1. Generate intent hash.
  2. Sign hash.
  3. Call \`Settlement.executeSettlement\` via RPC.
- [ ] Update intent status to \`executed\` with txHash.

**Acceptance Criteria:**
- Calling the trigger endpoint results in a real blockchain transaction." \
  --label "backend" --label "core"


# --- FASE 3: FRONTEND ---

# 10. Web3 Setup
gh issue create \
  --title "chore(frontend): Setup RainbowKit & Wagmi" \
  --body "Initialize Web3 providers in the Next.js app.

**Context:**
- Frontend is a Thin Client.

**Tasks:**
- [ ] Install RainbowKit, Wagmi, Viem.
- [ ] Wrap \`layout.tsx\` with Providers.
- [ ] Configure Cronos Testnet chain.

**Acceptance Criteria:**
- User can connect MetaMask/Rabby wallet." \
  --label "frontend" --label "web3"

# 11. Create Intent UI
gh issue create \
  --title "feat(frontend): Create Intent Form UI" \
  --body "Build the form to submit new payment intents.

**Context:**
- Refer to \`docs/NAMING_STANDARDS.md\` for component naming.

**Tasks:**
- [ ] Create \`components/create-intent-form.tsx\`.
- [ ] Inputs: Recipient Address, Amount, Condition Price.
- [ ] Handle submission to Backend API.

**Acceptance Criteria:**
- Form creates a new intent in the backend." \
  --label "frontend" --label "ui"

# 12. Dashboard UI
gh issue create \
  --title "feat(frontend): Intents Dashboard" \
  --body "Build the list view of all payment intents.

**Tasks:**
- [ ] Create \`components/intent-list.tsx\`.
- [ ] Fetch data from \`GET /intents\`.
- [ ] Show status badges (Yellow=Pending, Green=Executed).

**Acceptance Criteria:**
- Dashboard updates automatically or via refresh." \
  --label "frontend" --label "ui"

# 13. Trigger UI
gh issue create \
  --title "feat(frontend): Agent Trigger Button" \
  --body "Add the control to manually trigger the Agent evaluation.

**Tasks:**
- [ ] Add a 'Run Agent' button to the dashboard.
- [ ] Call \`POST /agent/trigger\`.
- [ ] Show loading state and result toast/notification.

**Acceptance Criteria:**
- User can trigger the agent flow from the UI." \
  --label "frontend" --label "ui"


# --- FASE 4: FINAL ---

# 14. E2E Test
gh issue create \
  --title "test(e2e): Full System Walkthrough" \
  --body "Perform and document a full end-to-end test.

**Tasks:**
- [ ] Record a video or screenshot log of the full flow:
  1. Create Intent.
  2. Trigger Agent.
  3. Verify on Cronoscan.
- [ ] Update README with the demo proof.

**Acceptance Criteria:**
- The system works from start to finish." \
  --label "testing" --label "release"

echo "✅ 14 Detailed Issues created successfully!"
