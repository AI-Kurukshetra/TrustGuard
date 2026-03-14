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
- `GET/POST /api/entity-lists`
- `GET/POST /api/models`
- `GET/POST /api/identity-verifications`
- `GET/POST /api/fraud-patterns`
- `GET/POST /api/geographical-locations`
- `GET/POST /api/behavioral-patterns`
- `POST /api/analytics/refresh`
- `GET /api/analytics/summary`
- `POST /api/graph/materialize`
- `POST /api/payment-methods/validate`
- `GET /api/auth/me`

Detailed contracts: `doc/API.md`

## Database

Supabase migrations are in:

- `supabase/migrations/20260314104500_initial_trustguard_schema.sql`
- `supabase/migrations/20260314111000_seed_demo_data.sql`
- `supabase/migrations/20260314114000_add_entity_lists.sql`
- `supabase/migrations/20260314120000_add_analytics_and_graph.sql`
- `supabase/migrations/20260314124000_add_patterns_geo_behavior_entities.sql`

Canonical schema reference: `doc/SCHEMA.md`

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
