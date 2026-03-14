# API Contracts

## In-Product API Docs

Operators can now access API documentation directly inside the dashboard at:

- `/api-docs`

The in-product page is driven by `lib/api-reference.ts`, and coverage is verified by
`tests/api-reference-coverage.test.ts` so newly added API routes are checked against documented method/path pairs.

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
- plan entitlements can additionally restrict advanced endpoints (for example federated learning, cross-merchant intelligence, quantum key rotation)

## JavaScript Agent Wrapper

For backend integrations that want less boilerplate, use:

- `lib/integrations/trustguard-js-agent.ts`

Example:

```ts
import { TrustGuardJsAgent } from "@/lib/integrations/trustguard-js-agent";

const trustguard = new TrustGuardJsAgent({
  baseUrl: process.env.TRUSTGUARD_BASE_URL!,
  apiKey: process.env.TRUSTGUARD_API_KEY!,
  merchantId: process.env.TRUSTGUARD_MERCHANT_ID!,
  timeoutMs: 5000,
  retries: 2
});

const { analysis } = await trustguard.scorePayment({
  device: {
    user_id: "external-123",
    browser: "Chrome",
    os: "Windows"
  },
  transaction: {
    amount: 249.99,
    currency: "USD",
    user_id: "external-123",
    country_code: "US"
  }
});
```

Provided helpers:

- `analyzeTransaction(...)`
- `registerDevice(...)`
- `scorePayment(...)` (register device + analyze in one call)
- `updateSessionBehavior(...)`
- `getAlerts()`

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
- derives failed-login and behavioral anomaly signals from `sessions` and `behavioral_patterns` when available
- derives latest user identity-verification status from `identity_verifications` when available
- applies model deployment assignment (`active`/`challenger`) from `model_deployments` when configured
- evaluates active `risk_rules`
- persists `transactions`, `risk_scores`, `rule_executions`
- auto-creates `alerts` and `fraud_cases` for `review` and `block`
- dispatches configured webhook/email/slack-style endpoints and records `webhook_deliveries` with retry attempts

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
  "registered": true,
  "trust_score": 82,
  "trust_risk_score": 18,
  "trust_signals": {
    "isKnownDevice": true,
    "linkedToDifferentUser": false,
    "hasHardwareSignature": true,
    "hasIpAddress": true,
    "accountDeviceCount": 2,
    "approvedTransactionCount90d": 10,
    "failedLoginEvents24h": 0,
    "daysSinceFirstSeen": 45,
    "daysSinceLastSeen": 1
  }
}
```

Behavior:

- computes a trust profile using novelty, stability, failed-login pressure, and recency decay signals
- persists `devices.trust_score` and embeds trust profile metadata for explainability
- upserts by `(merchant_id, device_hash)` to keep device history stable across re-registration

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

### GET/POST `/api/models/deployments`

Headers:

- `x-merchant-id: <merchant_uuid>`

Supports model deployment configuration per `deployment_target`:

- `active_model_id` (required)
- optional `challenger_model_id`
- optional `challenger_traffic_percent` (0-100)

`POST` upserts one deployment row per target and is used by scoring to assign `active` vs `challenger` model variants.

### GET/POST `/api/identity-verifications`

Headers:

- `x-merchant-id: <merchant_uuid>`

Supports ingest and retrieval of identity verification records.

### PATCH `/api/identity-verifications/{id}`

Headers:

- `x-merchant-id: <merchant_uuid>`

Updates identity verification state (`pending`, `verified`, `failed`, `expired`) and refreshes verification evidence fields (`score`, `provider`, `result_payload`).

### POST `/api/identity-verifications/callback`

Headers:

- `x-api-key: <integration_api_key>` or bearer/cookie auth
- `x-merchant-id: <merchant_uuid>`

Provider callback endpoint for asynchronous identity updates. Accepts either `verification_id` or `reference_id` plus status payload.

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

Validates payment method payloads using method-specific adapters (`card_v1`, `bank_v1`, `wallet_v1`, `generic_v1`) and updates `payment_methods.validation_status` when `payment_method_id` is provided.

Response shape:

```json
{
  "validated": true,
  "source": "rules_adapter_v2",
  "score": 84,
  "reasons": ["luhn_passed"],
  "adapter": "card_v1"
}
```

Behavior:

- returns a scored validation decision with explicit reasons
- stores validation details in `payment_methods.metadata.validation` for auditability

### POST `/api/users/risk-profile/refresh`

Headers:

- `x-merchant-id: <merchant_uuid>`

Refreshes user-level `risk_score` using a composite profile (recent transaction risk, blocked/review rates, chargebacks, identity verification status, and average device trust).

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

### GET/POST `/api/compliance/schedules`

Supports:

- list compliance automation schedules
- create or update report schedules (`admin`)

### POST `/api/compliance/schedules/run`

Supports:

- execute due schedules and generate compliance reports (`admin`)

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

### POST `/api/chargebacks/prevention`

Supports:

- generate chargeback-prevention playbooks from transaction/risk signals

### GET/POST `/api/graph/risk-score`

Supports:

- list persisted graph-risk findings (`GET`)
- compute and upsert graph-risk findings from `entity_connections` + `risk_scores` (`POST`)

### GET `/api/channels/baselines`

Supports:

- list channel-specific risk baselines (`web`, `mobile`, `api`, etc.)

### POST `/api/channels/ingest`

Supports:

- ingest channel events
- refresh `channel_risk_baselines`
- optionally run `analyzeTransaction` with derived `channel_risk_score`

### GET/POST `/api/analytics/historical`

Supports:

- list historical analysis snapshots (`GET`)
- generate windowed historical snapshots with anomaly flags + model-feedback payloads (`POST`)

### GET/POST `/api/contextual-auth/challenges`

Supports:

- list active/resolved contextual authentication challenges (`GET`)
- create risk-driven challenges (`POST`)

### PATCH `/api/contextual-auth/challenges/{id}/resolve`

Supports:

- resolve challenge status (`passed`, `failed`, `expired`)

## Advanced Feature Endpoints

### GET/POST `/api/advanced/federated-learning`

Supports:

- list federated learning rounds (`GET`)
- create/update rounds with aggregation metadata (`POST`)

### POST `/api/advanced/synthetic-fraud/generate`

Supports:

- generate synthetic fraud samples and persist generation batches

### POST `/api/advanced/explainability`

Supports:

- compute factor-level explainability for risk decisions and persist reports

### GET/POST `/api/advanced/cross-merchant/intelligence`

Supports:

- read hashed consortium intelligence aggregates (`GET`)
- publish merchant signal hashes and return consortium prevalence (`POST`)

### POST `/api/advanced/adversarial/detect`

Supports:

- detect adversarial payload patterns and persist detection records
- optionally feed adversarial score into transaction scoring

### POST `/api/advanced/dynamic-thresholds/recalculate`

Role: `admin`

Supports:

- recompute and persist merchant `risk_threshold_review` + `risk_threshold_block` from live metrics

### POST `/api/advanced/multimodal/analyze`

Supports:

- combine text/image/voice/behavior scores into one multimodal risk output
- optionally run transaction scoring with `multimodal_risk_score`

### POST `/api/advanced/simulation/run`

Supports:

- run fraud simulation scenarios and persist results

### GET/POST `/api/advanced/cryptography/keys`

Role: `admin` for `POST`

Supports:

- list hybrid quantum-ready key metadata (`GET`)
- rotate and activate new key versions (`POST`)

### POST `/api/advanced/blockchain/verify`

Supports:

- append immutable hash-chain verification records for entities

### POST `/api/advanced/automl/run`

Role: `admin`

Supports:

- run AutoML candidate selection from historical transactions
- persist best model candidate and `automl_runs` output

### GET `/api/billing/entitlements`

Supports:

- read merchant plan tier
- read feature entitlements
- read monthly usage vs quota limits
- return upgrade signals when usage approaches limits

### GET `/api/billing/usage`

Supports:

- read monthly usage events
- return daily usage rollups for billing reconciliation

Query params:

- `year` (optional)
- `month` (optional, 1-12)

### GET `/api/reports/scorecard`

Supports:

- combined business scorecard view: plan + usage + KPI summary + operational workload
- intended for customer-facing reporting/export use cases
