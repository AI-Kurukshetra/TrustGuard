# TrustGuard

TrustGuard is a multi-tenant fraud detection and response platform built with Next.js and Supabase. It provides a dashboard for analysts and API endpoints for transaction scoring, alerting, case workflows, risk rules, and compliance reporting.

## Tech Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth + RLS)
- Tailwind CSS
- Vitest (unit tests)
- Vercel CLI (deployment workflows)

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Corepack enabled (`corepack enable`)
- Supabase project credentials

### 2. Install Dependencies

```bash
corepack pnpm install
```

### 3. Configure Environment

Create a local env file from the example:

```bash
cp .env.example .env
```

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Run the App

```bash
corepack pnpm dev
```

App default URL: `http://localhost:3000`

## Product Usage Flow

1. Open `http://localhost:3000/signup` and create your operator account + merchant workspace.
2. You are signed in automatically and redirected to onboarding (`/onboarding`).
3. Use the sidebar to navigate:
   - `Onboarding` for first-run setup checklist
   - `Billing` for plan limits, entitlements, and billing readiness
   - `Command Center` for live KPIs and queue
   - `Transactions` for scored payment review
   - `Cases` for fraud investigations and case status actions
   - `Rules` for policy controls (create/enable/disable/delete)
   - `Alerts` for incident stream and acknowledgment actions
   - `Integrations` for API keys and backend wiring
4. Create an API key in `Integrations` and use it from your backend with `x-api-key` + `x-merchant-id`.
5. Optionally use the JS agent wrapper at `lib/integrations/trustguard-js-agent.ts` to avoid manual header/retry logic.
6. Use `Sign out` in the sidebar to end the session.

For returning users: `http://localhost:3000/login`.

## Useful Commands

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:checklist
corepack pnpm build
corepack pnpm start
corepack pnpm exec vercel --version
```

## API Surface (Current)

- `POST /api/transactions/analyze`
- `GET /api/alerts`
- `PATCH /api/cases/:id`
- `GET/POST /api/rules`
- `GET/POST /api/webhooks`
- `GET/POST /api/compliance/reports`
- `GET/POST /api/compliance/schedules`
- `POST /api/compliance/schedules/run`
- `GET/POST /api/entity-lists`
- `GET/POST /api/models`
- `GET/POST /api/models/deployments`
- `GET/POST /api/identity-verifications`
- `PATCH /api/identity-verifications/:id`
- `POST /api/identity-verifications/callback`
- `GET/POST /api/fraud-patterns`
- `POST /api/chargebacks/prevention`
- `GET/POST /api/geographical-locations`
- `GET/POST /api/behavioral-patterns`
- `POST /api/analytics/refresh`
- `GET/POST /api/analytics/historical`
- `GET /api/analytics/summary`
- `POST /api/graph/materialize`
- `GET/POST /api/graph/risk-score`
- `GET /api/channels/baselines`
- `POST /api/channels/ingest`
- `POST /api/payment-methods/validate`
- `GET/POST /api/contextual-auth/challenges`
- `PATCH /api/contextual-auth/challenges/:id/resolve`
- `GET/POST /api/advanced/federated-learning`
- `POST /api/advanced/synthetic-fraud/generate`
- `POST /api/advanced/explainability`
- `GET/POST /api/advanced/cross-merchant/intelligence`
- `POST /api/advanced/adversarial/detect`
- `POST /api/advanced/dynamic-thresholds/recalculate`
- `POST /api/advanced/multimodal/analyze`
- `POST /api/advanced/simulation/run`
- `GET/POST /api/advanced/cryptography/keys`
- `POST /api/advanced/blockchain/verify`
- `POST /api/advanced/automl/run`
- `GET /api/billing/entitlements`
- `GET /api/billing/usage`
- `GET /api/reports/scorecard`
- `GET /api/auth/me`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET|POST /api/auth/logout`
- `GET/POST /api/integrations/keys`
- `DELETE /api/integrations/keys/:id`

Detailed contracts: `doc/API.md`

## JavaScript Agent Integration

Use the built-in JS wrapper from your backend service:

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

The wrapper handles:

- `x-api-key` + `x-merchant-id` headers
- timeout and retry behavior
- typed endpoint methods (`analyzeTransaction`, `registerDevice`, `scorePayment`, `getAlerts`)

## Database

Supabase migrations are in:

- `supabase/migrations/20260314104500_initial_trustguard_schema.sql`
- `supabase/migrations/20260314111000_seed_demo_data.sql`
- `supabase/migrations/20260314114000_add_entity_lists.sql`
- `supabase/migrations/20260314120000_add_analytics_and_graph.sql`
- `supabase/migrations/20260314124000_add_patterns_geo_behavior_entities.sql`
- `supabase/migrations/20260314133000_add_api_request_metrics.sql`
- `supabase/migrations/20260314143000_seed_remaining_tables.sql`
- `supabase/migrations/20260314151000_add_integration_api_keys.sql`
- `supabase/migrations/20260314155100_add_model_deployments.sql`
- `supabase/migrations/20260314160500_add_compliance_schedules.sql`
- `supabase/migrations/20260314172000_add_advanced_intelligence_features.sql`
- `supabase/migrations/20260314173000_add_billing_usage_and_entitlements.sql`
- `supabase/migrations/20260314184000_add_billing_usage_notifications.sql`

Canonical schema reference: `doc/SCHEMA.md`

## One Live Database for Local + Vercel

Use the same Supabase project credentials in both environments:

Local `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Vercel project env vars: set the exact same three values for Production/Preview/Development.

Example:

```bash
corepack pnpm exec vercel env add NEXT_PUBLIC_SUPABASE_URL
corepack pnpm exec vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
corepack pnpm exec vercel env add SUPABASE_SERVICE_ROLE_KEY
```

Notes:

- Data is shared live because both deployments point to one Supabase DB.
- Browser cookies are domain-specific (`localhost` vs Vercel domain), so login sessions are separate per domain.
- API keys from `Integrations` work from any environment as long as they target the same backend and merchant.

## Project Docs

- Product requirements: `doc/PRD.md`
- Task tracking: `doc/TASKS.md`
- Progress log: `doc/PROGRESS.md`
- Blockers: `doc/BLOCKERS.md`
- Changelog: `doc/CHANGELOG.md`
- Decisions: `doc/DECISIONS.md`

## Known Environment Issues

- In this sandbox, `pnpm build` can fail with an `EXDEV` cross-device rename issue in `.next`.
- In this sandbox, `pnpm test` can fail with `EAI_AGAIN localhost`.

These are currently tracked in `doc/BLOCKERS.md`.
