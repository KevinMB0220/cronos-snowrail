# API & Error Handling Standards

## Global Response Format
All API endpoints must return a unified JSON structure.

### 1. Success
Used when an operation completes fully as expected.
```json
{
  "status": "success",
  "code": "OPERATION_COMPLETED",
  "message": "Human readable success message",
  "data": {
    "id": "123",
    "result": "..."
  }
}
```

### 2. Warning
Used when operation completes but with caveats (e.g., Agent decided NOT to execute).
```json
{
  "status": "warning",
  "code": "CONDITION_NOT_MET",
  "message": "Payment condition was not satisfied",
  "data": null
}
```

### 3. Error
Used when an operation fails (server error, validation error, on-chain revert).
```json
{
  "status": "error",
  "code": "INTERNAL_ERROR",
  "message": "Detailed error description",
  "details": {
    "traceId": "...",
    "originalError": "..."
  }
}
```

## Standard Error Codes

| Code | Description |
|------|-------------|
| `INTENT_CREATED` | Payment intent successfully registered |
| `AGENT_DECISION_SKIP` | Agent evaluated condition as false |
| `AGENT_DECISION_EXECUTE` | Agent evaluated condition as true |
| `SETTLEMENT_FAILED` | On-chain transaction reverted |
| `VALIDATION_ERROR` | Input data is malformed |
| `UNAUTHORIZED` | Invalid signature or permissions |
| `X402_ROUTING_ERROR` | Failed to contact x402 facilitator |

## HTTP Status Mapping
- **200 OK**: Success & Warning
- **400 Bad Request**: Validation errors
- **401 Unauthorized**: Auth errors
- **500 Internal Server Error**: System/Chain failures

