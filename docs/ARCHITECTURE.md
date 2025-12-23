# System Architecture

## Overview
**Cronos x402 Agentic Treasury** is a hybrid system where an off-chain AI Agent controls on-chain programmatic settlements via the x402 protocol on Cronos EVM.

## High-Level Flow

```mermaid
graph TD
    User((User)) -->|1. Create Intent| FE[Frontend]
    FE -->|2. Submit| API[Backend API]
    
    subgraph "Unified Backend (The Brain)"
        API -->|3. Store| DB[(Memory/DB)]
        API -->|4. Trigger| Agent[AI Agent]
        Agent -->|5. Evaluate Condition| PriceOracle[Price Feed]
        Agent -->|6. Decision: EXECUTE| Orch[x402 Orchestrator]
    end
    
    subgraph "On-Chain (Cronos EVM)"
        Orch -->|7. Tx via Facilitator| Settlement[Settlement.sol]
        Settlement -->|8. Verify & Transfer| Recipient((Recipient))
    end
    
    Settlement -.->|9. Event Emitted| API
    API -.->|10. Update Status| FE
```

## Core Components

### 1. Payment Intent (The Truth)
The atomic unit of the system.
- **ID**: UUID
- **Condition**: Logic to evaluate (e.g., `ETH < 3000`)
- **Status**: `pending` -> `executed` | `failed`

### 2. AI Agent (The Decider)
- **Role**: Pure logic.
- **Input**: Payment Intent + External Data (Price, Time).
- **Output**: Boolean Decision (`EXECUTE` / `SKIP`).
- **Constraint**: NEVER signs transactions directly.

### 3. x402 Orchestrator (The Executor)
- **Role**: Execution mechanism.
- **Input**: Positive Agent Decision.
- **Action**: Signs & broadcasts transaction to `Settlement.sol`.

### 4. Settlement Contract (The Vault)
- **Network**: Cronos Testnet (EVM)
- **Role**: Holds funds & executes transfers.
- **Security**: Verifies `intentHash` before releasing funds.

