# API Contracts

## Tenant Context

Protected API routes require:

- `Authorization: Bearer <supabase_jwt>`
- Merchant scope via `x-merchant-id` header or `merchant_id` payload

For browser sessions created via `/api/auth/login` or `/api/auth/signup`, protected routes also accept:

- `tg_access_token` cookie (auth token)
- `tg_merchant_id` cookie (merchant scope)

Server-to-server integrations may authenticate with:

- `x-api-key: <integration_api_key>`
- `x-merchant-id: <merchant_uuid>` (optional if key is merchant-bound, but recommended)

Role enforcement:

- `viewer`: read endpoints
- `analyst`: investigation and operational write endpoints
- `admin`: policy/config endpoints

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

### PATCH `/api/alerts/{id}`

Role: `analyst`

Acknowledges an alert by setting:

- `acknowledged_at = now()`
- `acknowledged_by = current user` (or `null` for API-key auth)

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

### GET/POST/DELETE `/api/entity-lists`

Headers:

- `x-merchant-id: <merchant_uuid>`

Supports:

- fetch whitelist/blacklist records
- upsert list records (`list_type`, `entity_type`, `entity_value`)
- delete list records

### GET/POST `/api/models`

Headers:

- `x-merchant-id: <merchant_uuid>`

Supports basic model registry operations for tenant-level model metadata.

### GET/POST `/api/identity-verifications`

Headers:

- `x-merchant-id: <merchant_uuid>`

Supports ingest and retrieval of identity verification records.

### PATCH `/api/sessions/{id}/behavior`

Headers:

- `x-merchant-id: <merchant_uuid>`

Stores behavioral biometrics payloads on a session record.

### POST `/api/analytics/refresh`

Headers:

- `x-merchant-id: <merchant_uuid>`

Builds or refreshes one `daily_risk_metrics` row from transactions and chargebacks for a target day.

### GET `/api/analytics/summary`

Headers:

- `x-merchant-id: <merchant_uuid>`

Returns historical metrics from `daily_risk_metrics` for trend dashboards.

### POST `/api/reports/generate`

Headers:

- `x-merchant-id: <merchant_uuid>`

Generates and stores a compliance report payload in `compliance_reports`.

### GET `/api/reports/kpis`

Headers:

- `x-merchant-id: <merchant_uuid>`

Returns KPI summary for a lookback window (`?days=30` default), including:

- estimated fraud precision/recall and false-positive/false-negative rates
- transaction scoring latency (`avg`, `p95`) from `api_request_metrics`
- API uptime percentage from recorded request statuses
- revenue protected estimate from blocked transaction amounts
- compliance report generation success rate

### POST `/api/graph/materialize`

Headers:

- `x-merchant-id: <merchant_uuid>`

Materializes `user -> device` and `user -> payment_method` connections into `entity_connections`.

### POST `/api/payment-methods/validate`

Headers:

- `x-merchant-id: <merchant_uuid>`

Validates payment method payloads using current adapter heuristics and updates `payment_methods.validation_status` when `payment_method_id` is provided.

### POST `/api/users/risk-profile/refresh`

Headers:

- `x-merchant-id: <merchant_uuid>`

Refreshes user-level `risk_score` by aggregating recent transaction risk scores.

### GET `/api/auth/me`

Returns authenticated user identity and active merchant memberships from Supabase auth token.

### POST `/api/auth/signup`

Request body:

```json
{
  "email": "ops@acme.com",
  "password": "strong-password",
  "merchant_name": "Acme Payments"
}
```

Behavior:

- creates Supabase auth user
- provisions a new merchant tenant
- assigns the user as `admin` in `merchant_members`
- auto-signs in and sets auth cookies

### POST `/api/auth/login`

Request body:

```json
{
  "email": "ops@acme.com",
  "password": "strong-password"
}
```

Optional: `merchant_id` to target a specific membership when user belongs to multiple merchants.

Response includes selected `merchant_id`, role, and sets auth cookies.

### GET/POST `/api/auth/logout`

Clears auth cookies and redirects to `/login`.

### GET/POST `/api/integrations/keys`

Role: `admin`

- `GET` lists merchant API key metadata (masked key value only; full key is never returned again).
- `POST` creates a new API key.

Create request body:

```json
{
  "name": "Primary backend",
  "role": "analyst",
  "expires_in_days": 90
}
```

Create response includes one-time `api_key` plaintext plus key metadata.

### DELETE `/api/integrations/keys/{id}`

Role: `admin`

Revokes an API key by setting `active=false` and `revoked_at=now()`.

### GET/POST `/api/rules`

Supports:

- list tenant risk rules
- create risk rules (`admin`)

### PATCH/DELETE `/api/rules/{id}`

Supports:

- update risk rule metadata/condition/action (`admin`)
- delete tenant risk rule (`admin`)

### GET/POST `/api/webhooks`

Supports:

- list webhook endpoints and recent deliveries
- create webhook endpoint (`admin`)

### PATCH/DELETE `/api/webhooks/{id}`

Supports:

- update endpoint target, events, activation (`admin`)
- delete webhook endpoint (`admin`)

### GET/POST `/api/compliance/reports`

Supports:

- list compliance reports for a tenant
- create compliance report artifact (`admin`)

### GET/POST `/api/geographical-locations`

Supports:

- list merchant-scoped location risk records
- create location risk records (`analyst`)

### GET/POST `/api/behavioral-patterns`

Supports:

- list behavioral pattern observations
- create pattern observations (`analyst`)

### GET/POST `/api/fraud-patterns`

Supports:

- list fraud pattern records
- create fraud pattern records (`analyst`)

### PATCH/DELETE `/api/fraud-patterns/{id}`

Supports:

- update pattern metadata/status (`analyst`)
- delete pattern (`admin`)
