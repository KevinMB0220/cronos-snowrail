# Cronos x402 Agentic Treasury 🤖💸

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-MVP-green.svg)
![Network](https://img.shields.io/badge/network-Cronos%20Testnet-blue)
![Stack](https://img.shields.io/badge/tech-x402%20%7C%20AI%20Agents%20%7C%20Next.js-purple)

**Autonomous AI-driven treasury settlement system built on Cronos EVM.**

This project demonstrates a production-ready **Agentic Treasury** where an AI Agent autonomously evaluates market conditions to execute programmatic payments via the **x402 Paytech** protocol.

---

## 📚 Documentation

- [**Architecture Overview**](./docs/ARCHITECTURE.md) - System design & data flow.
- [**API Standards**](./docs/API_STANDARDS.md) - Response formats & error codes.
- [**Naming Conventions**](./docs/NAMING_STANDARDS.md) - Code style & repository structure.
- [**Development Roadmap**](./ISSUES.md) - Step-by-step implementation plan.

---

## 🚀 Key Features

- **🧠 Autonomous Decision Making**: AI Agent evaluates price/time conditions off-chain.
- **⚡️ x402 Integration**: Programmatic payment execution on Cronos.
- **🛡️ Secure Settlement**: On-chain verification via `Settlement.sol`.
- **🏗️ Clean Architecture**: Strict separation of concerns (Thin Client Frontend / Unified Backend).

---

## 🛠️ Tech Stack

### Backend (The Brain)
- **Node.js 20** + **Fastify**
- **AI Agent Logic** (Deterministic)
- **x402 Orchestrator**

### Frontend (The Viewer)
- **Next.js 14** (App Router)
- **TailwindCSS**
- **WalletConnect**

### Blockchain
- **Cronos EVM** (Testnet)
- **Solidity 0.8.24**
- **Hardhat**

---

## 🏁 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Configure `.env` files in each workspace using the provided examples:
- `apps/backend/ENV_EXAMPLE` → `apps/backend/.env`
- `apps/frontend/ENV_EXAMPLE` → `apps/frontend/.env.local`
- `contracts/ENV_EXAMPLE` → `contracts/.env`

### 3. Run Development
```bash
# Starts Backend, Frontend, and Types compiler
npm run dev
```

---

## 🧪 Testing

```bash
# Run contract tests
npm run test:contracts
```

---

## 📜 License
MIT
