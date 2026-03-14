# API Contracts

## Tenant Context

Protected API routes require merchant scope.

Use either:

- `x-merchant-id` request header
- `merchant_id` field in request payload (for write routes)

If missing, APIs return `400`.

## Endpoints

### POST `/api/transactions/analyze`

Request body (minimum):

```json
{
  "amount": 1622.11,
  "currency": "USD",
  "user_id": "10000000-0000-0000-0000-000000000002",
  "country_code": "US"
}
```

Response (sample):

```json
{
  "transaction_id": "70000000-0000-0000-0000-000000000002",
  "risk_score": 73,
  "decision": "review",
  "explanation": ["high_amount", "new_device"],
  "matched_rules": ["High Amount + New Device"],
  "persisted": true,
  "alert_id": "a0000000-0000-0000-0000-000000000002",
  "case_id": "b0000000-0000-0000-0000-000000000001"
}
```

Behavior:

- derives velocity windows (`1h`, `24h`) from historical transactions
- enriches geo mismatch and impossible travel signals when session coordinates are available
- evaluates active `risk_rules`
- persists `transactions`, `risk_scores`, `rule_executions`
- auto-creates `alerts` and `fraud_cases` for `review` and `block`
- dispatches configured webhooks and records `webhook_deliveries`

### POST `/api/devices/register`

Request body:

```json
{
  "user_id": "10000000-0000-0000-0000-000000000001",
  "browser": "Chrome",
  "os": "macOS",
  "screen_resolution": "1728x1117",
  "ip_address": "34.219.28.17",
  "hardware_signature": "sig_maya_mac"
}
```

Response:

```json
{
  "user_id": "10000000-0000-0000-0000-000000000001",
  "device_hash": "fp_a8bz90",
  "registered": true
}
```

### GET `/api/alerts`

Headers:

- `x-merchant-id: <merchant_uuid>`

Response:

```json
{
  "data": [],
  "channels": ["dashboard", "email", "webhook", "slack"]
}
```

### GET `/api/users/{id}/risk-profile`

Headers:

- `x-merchant-id: <merchant_uuid>`

Returns merchant-scoped risk profile for one user.

### PATCH `/api/cases/{id}`

Request body:

```json
{
  "status": "resolved",
  "note": "Customer verified by analyst."
}
```

Allowed statuses:

- `open`
- `in_review`
- `escalated`
- `resolved`

Behavior:

- updates `fraud_cases.status`
- sets `resolved_at` for `resolved`
- writes audit event to `fraud_case_events`
