# Naming & Coding Standards

## File & Directory Naming
- **Directories**: `kebab-case` (e.g., `components/payment-card/`)
- **Files**: `kebab-case` (e.g., `user-profile.tsx`, `agent-service.ts`)
- **Tests**: `filename.test.ts` or `filename.spec.ts`

## Code Conventions

### Variables & Functions
- **Format**: `camelCase`
- **Variables**: Nouns (e.g., `userBalance`, `paymentIntent`)
- **Functions**: Verbs (e.g., `calculateTotal`, `executeSettlement`)
- **Booleans**: Prefix with `is`, `has`, `should` (e.g., `isValid`, `hasFunds`)

### Classes & Types
- **Format**: `PascalCase`
- **Classes**: `PaymentAgent`, `SettlementService`
- **Interfaces/Types**: `PaymentIntent`, `ApiResponse`

### Constants & Environment Variables
- **Format**: `UPPER_SNAKE_CASE`
- **Examples**: `MAX_RETRY_COUNT`, `CRONOS_RPC_URL`

## Component Structure (Frontend)
- One component per file.
- Component name matches filename (PascalCase in code, kebab-case in file).
- Props interface named `[ComponentName]Props`.

## Specific Rules
- **Hooks**: Must start with `use-` in filename and `use` in function name.
- **Async**: Async functions should ideally imply action (e.g., `fetchData`, `submitTransaction`).

