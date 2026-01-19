# Chat-Based Payment System - Implementation Guide

## Overview

This guide provides step-by-step instructions to implement the chat-based payment system for Cronos Snow Rail.

## Prerequisites

- Node.js >= 20
- PostgreSQL database
- Redis server
- npm or yarn

## Phase 1: Database & Dependencies Setup

### Step 1: Install Dependencies

```bash
# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ../..
```

### Step 2: Setup PostgreSQL Database

Create a new PostgreSQL database:

```bash
# Using psql
createdb cronos_snowrail

# Or using Docker
docker run --name cronos-postgres \
  -e POSTGRES_DB=cronos_snowrail \
  -e POSTGRES_USER=cronos \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:16
```

### Step 3: Configure Environment Variables

Create `/apps/backend/.env`:

```bash
# Existing variables
PRIVATE_KEY=your_wallet_private_key
RPC_URL=https://evm-t3.cronos.org
CHAIN_ID=338
SETTLEMENT_CONTRACT_ADDRESS=0xae6E14caD8D4f43947401fce0E4717b8D17b4382
MIXER_CONTRACT_ADDRESS=0xfAef6b16831d961CBd52559742eC269835FF95FF

# New variables for chat system
DATABASE_URL=postgresql://cronos:your_password@localhost:5432/cronos_snowrail
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=your_jwt_secret_here

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
```

Create `/apps/frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Step 4: Setup Redis

```bash
# Using Docker
docker run --name cronos-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Or install locally (macOS)
brew install redis
brew services start redis

# Or install locally (Ubuntu)
sudo apt-get install redis-server
sudo systemctl start redis
```

### Step 5: Initialize Prisma

```bash
cd apps/backend

# Generate Prisma client
npm run prisma:generate

# Push schema to database (for development)
npm run prisma:push

# Or create and run migrations (for production)
npm run prisma:migrate
```

## Phase 2: Backend Services Implementation

### Files Created

The following files need to be implemented based on the architecture:

#### Core Services

1. **WebSocket Service** (`/apps/backend/src/services/websocket-service.ts`)
   - Connection management
   - Authentication
   - Event broadcasting
   - Room management

2. **Chat Service** (`/apps/backend/src/services/chat-service.ts`)
   - Message storage and retrieval
   - Command parsing
   - Message broadcasting

3. **Command Parser** (`/apps/backend/src/services/command-parser.ts`)
   - Parse chat commands
   - Validate parameters
   - Extract command arguments

4. **Notification Service** (`/apps/backend/src/services/notification-service.ts`)
   - Create notifications
   - Real-time notification broadcasting
   - Mark as read/unread
   - Notification storage

5. **Bulk Payment Service** (`/apps/backend/src/services/bulk-payment-service.ts`)
   - Parse CSV/JSON files
   - Validate bulk transactions
   - Create batch jobs
   - Process transactions in parallel

6. **Prisma Service** (`/apps/backend/src/services/prisma-service.ts`)
   - Prisma client initialization
   - Connection management
   - Singleton pattern

#### API Routes

1. **Chat Routes** (`/apps/backend/src/api/routes/chat.ts`)
   ```typescript
   POST   /api/chat/messages         - Send message
   GET    /api/chat/messages         - Get chat history
   DELETE /api/chat/messages/:id     - Delete message
   ```

2. **Notification Routes** (`/apps/backend/src/api/routes/notifications.ts`)
   ```typescript
   GET    /api/notifications         - Get notifications
   POST   /api/notifications/:id/read - Mark as read
   POST   /api/notifications/read-all  - Mark all as read
   DELETE /api/notifications/:id     - Dismiss notification
   ```

3. **Bulk Payment Routes** (`/apps/backend/src/api/routes/bulk.ts`)
   ```typescript
   POST   /api/bulk/upload           - Upload CSV/JSON
   POST   /api/bulk/batches          - Create batch
   GET    /api/bulk/batches/:id      - Get batch status
   POST   /api/bulk/batches/:id/execute - Execute batch
   GET    /api/bulk/batches/:id/results - Get results
   ```

4. **WebSocket Routes** (`/apps/backend/src/api/routes/websocket.ts`)
   - Socket.io integration with Fastify
   - Event handlers
   - Authentication middleware

#### Utilities

1. **Command Validator** (`/apps/backend/src/utils/command-validator.ts`)
   - Zod schemas for command validation
   - Address validation
   - Amount validation

2. **Response Formatter** (`/apps/backend/src/utils/response-formatter.ts`)
   - Format chat responses
   - Create transaction previews
   - Generate rich notifications

3. **Queue Worker** (`/apps/backend/src/workers/bulk-processor.ts`)
   - Bull queue worker
   - Process bulk transactions
   - Handle failures and retries

## Phase 3: Frontend Implementation

### Components to Create

#### Chat Components

1. **ChatInterface** (`/apps/frontend/src/components/chat/chat-interface.tsx`)
   - Main chat container
   - WebSocket connection
   - Message list
   - Input field

2. **MessageList** (`/apps/frontend/src/components/chat/message-list.tsx`)
   - Display messages
   - Auto-scroll
   - Message grouping
   - Rich message rendering

3. **MessageInput** (`/apps/frontend/src/components/chat/message-input.tsx`)
   - Text input
   - Command auto-completion
   - Send button
   - File upload for bulk

4. **CommandSuggestions** (`/apps/frontend/src/components/chat/command-suggestions.tsx`)
   - Auto-complete dropdown
   - Command help
   - Recent commands

5. **TransactionPreview** (`/apps/frontend/src/components/chat/transaction-preview.tsx`)
   - Rich transaction preview
   - Confirm/cancel buttons
   - Gas estimation
   - Amount formatting

#### Notification Components

1. **NotificationCenter** (`/apps/frontend/src/components/notifications/notification-center.tsx`)
   - Notification list
   - Filter by type
   - Mark all as read
   - Notification actions

2. **NotificationItem** (`/apps/frontend/src/components/notifications/notification-item.tsx`)
   - Single notification display
   - Icon rendering
   - Action buttons
   - Read/unread state

3. **ToastNotification** (`/apps/frontend/src/components/notifications/toast-notification.tsx`)
   - Animated toast
   - Auto-dismiss
   - Progress bar
   - Different styles

4. **NotificationBell** (`/apps/frontend/src/components/notifications/notification-bell.tsx`)
   - Bell icon with badge
   - Unread count
   - Dropdown toggle

#### Bulk Payment Components

1. **BulkUpload** (`/apps/frontend/src/components/bulk/bulk-upload.tsx`)
   - File drag & drop
   - CSV/JSON parsing
   - Data validation
   - Preview table

2. **BatchPreview** (`/apps/frontend/src/components/bulk/batch-preview.tsx`)
   - Summary statistics
   - Transaction list
   - Total amount
   - Estimated gas

3. **BatchProgress** (`/apps/frontend/src/components/bulk/batch-progress.tsx`)
   - Progress bar
   - Real-time updates
   - Transaction status
   - Current item

4. **BatchReport** (`/apps/frontend/src/components/bulk/batch-report.tsx`)
   - Completion report
   - Success/failure breakdown
   - Download results
   - Failed transactions

#### Hooks

1. **useWebSocket** (`/apps/frontend/src/hooks/use-websocket.ts`)
   - WebSocket connection
   - Event listeners
   - Auto-reconnect
   - Connection status

2. **useChat** (`/apps/frontend/src/hooks/use-chat.ts`)
   - Send messages
   - Get chat history
   - Real-time updates
   - React Query integration

3. **useNotifications** (`/apps/frontend/src/hooks/use-notifications.ts`)
   - Get notifications
   - Mark as read
   - Real-time updates
   - Unread count

4. **useBulkPayment** (`/apps/frontend/src/hooks/use-bulk-payment.ts`)
   - Upload CSV
   - Create batch
   - Execute batch
   - Get status

#### Services

1. **WebSocket Client** (`/apps/frontend/src/services/websocket-client.ts`)
   - Socket.io client
   - Event emitters
   - TypeScript types
   - Error handling

2. **Notification Client** (`/apps/frontend/src/services/notification-client.ts`)
   - Browser notifications API
   - Permission handling
   - Sound effects

## Phase 4: Integration with Existing Services

### Modify Existing Files

1. **Intent Service** (`/apps/backend/src/services/intent-service.ts`)
   - Migrate from in-memory Map to Prisma
   - Keep backward compatibility
   - Add user association

2. **Backend Index** (`/apps/backend/src/index.ts`)
   - Initialize Prisma
   - Setup WebSocket server
   - Setup Redis connection
   - Register new routes

3. **Frontend Layout** (`/apps/frontend/src/app/layout.tsx`)
   - Add WebSocket provider
   - Add NotificationProvider
   - Add ChatProvider

## Phase 5: Testing

### Unit Tests

```bash
# Backend tests
cd apps/backend
npm test

# Frontend tests
cd apps/frontend
npm test
```

### Integration Tests

1. Test WebSocket connection
2. Test chat message flow
3. Test notification delivery
4. Test bulk payment processing

### E2E Tests

1. Complete payment flow via chat
2. Bulk payment from upload to completion
3. Real-time notifications
4. Multi-user scenarios

## Phase 6: Deployment

### Database Migration

```bash
# Production migration
cd apps/backend
npm run prisma:migrate
```

### Environment Setup

1. Production PostgreSQL database
2. Redis cluster for scalability
3. Environment variables in hosting platform

### Scaling Considerations

1. **WebSocket Scaling**
   - Use Redis adapter for Socket.io
   - Multiple server instances
   - Sticky sessions or Redis pub/sub

2. **Queue Workers**
   - Separate worker processes
   - Horizontal scaling
   - Dead letter queues

3. **Database**
   - Connection pooling
   - Read replicas
   - Indexes on frequently queried fields

## Command Examples

### Payment Commands

```bash
# Simple payment
/pay 0x742d35Cc6634C0532925a3b844Bc9e7595f39dF4 100 CRO

# With condition
/pay 0x742d35Cc6634C0532925a3b844Bc9e7595f39dF4 100 CRO when price below 0.50

# Deposit
/deposit intent-123 100

# Withdraw from mixer
/withdraw mixer-note-abc123

# Mix for privacy
/mix 0.1
```

### Status Commands

```bash
# Check intent
/status intent-123

# Check wallet
/wallet

# View history
/history 20
```

### Bulk Commands

```bash
# Upload CSV
/bulk upload

# Preview batch
/bulk preview batch-456

# Execute batch
/bulk execute batch-456

# Check status
/bulk status batch-456
```

## Monitoring

### Metrics to Track

1. WebSocket connections
2. Messages per second
3. Notification delivery time
4. Bulk batch processing time
5. Database query performance
6. Redis cache hit rate

### Logging

1. Structured logging with Pino
2. Request/response logging
3. Error tracking with Sentry
4. WebSocket event logging

## Security Checklist

- [ ] Input validation on all commands
- [ ] Rate limiting on chat messages
- [ ] Rate limiting on bulk uploads
- [ ] WebSocket authentication
- [ ] CORS configuration
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention in chat messages
- [ ] File upload size limits
- [ ] Transaction amount limits
- [ ] Audit logging

## Performance Optimization

1. **Caching**
   - Redis for user sessions
   - Cache frequently accessed intents
   - Cache wallet balances

2. **Database**
   - Proper indexes
   - Query optimization
   - Connection pooling

3. **WebSocket**
   - Message batching
   - Compression
   - Efficient serialization

4. **Frontend**
   - Virtual scrolling for long lists
   - Lazy loading
   - Code splitting

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check CORS configuration
   - Verify WebSocket URL
   - Check firewall rules

2. **Prisma Connection Error**
   - Verify DATABASE_URL
   - Check PostgreSQL running
   - Check connection pooling

3. **Redis Connection Error**
   - Verify Redis running
   - Check REDIS_HOST/PORT
   - Check password

4. **Bull Queue Not Processing**
   - Check Redis connection
   - Verify worker process running
   - Check queue configuration

## Next Steps

After completing the foundation, implement:

1. Advanced features (AI assistant, scheduling, templates)
2. Mobile app with React Native
3. Advanced analytics dashboard
4. Multi-language support
5. Voice commands
6. Integration with more blockchains

## Resources

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Redis Documentation](https://redis.io/documentation)
- [Framer Motion Documentation](https://www.framer.com/motion/)

## Support

For issues or questions:
- GitHub Issues: [cronos-snowrail/issues](https://github.com/cronos/cronos-snowrail/issues)
- Documentation: `/docs` folder
- Architecture: `/docs/CHAT_PAYMENT_ARCHITECTURE.md`
