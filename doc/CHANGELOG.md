# Changelog

## 2026-03-14

- Initialized the TrustGuard MVP repository with docs, Next.js/Tailwind configuration, dashboard UI, and PRD-shaped mock API routes.
- Added typed-route-safe navigation, ESLint configuration, and a generated `package-lock.json` after installing project dependencies.
- Verified lint and typecheck successfully; documented the remaining environment-specific Next.js build failure caused by an `EXDEV` filesystem rename.
- Rewrote `doc/PRD.md` as a full product requirements document covering overview, goals, users, MVP scope, features, schema, metrics, and go-to-market.
- Added root-level `PRD.md` capturing the external market-analysis brief, prioritized feature set, differentiators, entity model, endpoint groups, monetization, and GTM guidance.
- Replaced the basic schema stub with a detailed TrustGuard Supabase/Postgres schema design in `doc/SCHEMA.md`.
- Added the first Supabase migration implementing the TrustGuard schema, tenant membership model, triggers, indexes, and RLS policies.
- Added Supabase environment/client scaffolding, rewired the dashboard and API routes to a shared repository with fallback behavior, and created a demo seed migration.
- Added `doc/ROADMAP.md` defining three sprint phases, feature mapping for all 20 core capabilities, and commit conventions for ongoing implementation.
- Upgraded transaction scoring to execute active `risk_rules`, compute decision overrides by rule priority/severity, and persist evaluation traces in `rule_executions`.
- Added DB-derived velocity windows (`velocity_1h`, `velocity_24h`) and geolocation enrichment (country mismatch and impossible-travel speed checks) into scoring decisions.
- Added tenant-scoped API request enforcement, auto-created alerts/cases from scoring outcomes, webhook delivery logging, and a case status transition endpoint with event audit trail.
- Added `doc/API.md` with current endpoint contracts and required tenant context conventions.
- Added whitelist/blacklist management (`entity_lists`) with schema migration, API CRUD, and scoring-time list match adjustments.
- Added basic model registry, identity verification ingest/query, and session behavioral biometrics APIs as Sprint 2 foundations.
- Added Sprint 3 analytics/graph/compliance foundations: schema for daily metrics + entity connections, analytics refresh/summary APIs, compliance report generation API, and graph materialization API.
- Added payment method validation and user risk-profile refresh APIs, and enriched scoring with failed-login/chargeback-history/payment-validation heuristics.
- Added Vitest test scaffolding and unit tests for rule-condition and heuristic-scoring logic.
- Hardened API authentication with bearer token + tenant membership role checks, introduced request-scoped Supabase clients, and removed service-role client fallback from request API paths.
- Added missing API groups: `/api/auth/me`, `/api/rules`, `/api/webhooks`, and `/api/compliance/reports` with role-based tenant guards.
- Added first-class schema entities and API routes for `fraud_patterns`, `geographical_locations`, and `behavioral_patterns`.
- Added a one-command pre-commit checklist via `scripts/test-checklist.sh` and `npm run test:checklist` to run lint, typecheck, unit tests, and optional smoke API checks.
- Added `vitest.config.ts` with explicit `@` alias resolution so tests can import project modules using the same path convention as app code.
- Ran a full authenticated local API verification matrix and documented that several newer endpoint groups fail because related Supabase migrations are not yet applied on the connected project.
- Pushed pending Supabase migrations to the linked remote project, restoring table availability for analytics, graph, entity lists, and pattern/location endpoints.
- Fixed `/api/graph/materialize` to deduplicate relation keys before upsert, preventing Postgres `ON CONFLICT DO UPDATE` multi-hit errors.
- Updated `scripts/smoke-test.sh` to generate per-run unique values for insert-heavy endpoints so repeated local smoke runs remain idempotent.
- Added `vercel` CLI as a project dev dependency using `pnpm` and generated a `pnpm-lock.yaml` for reproducible package resolution.
- Added a root `README.md` with local setup, required environment variables, pnpm/vercel commands, API route summary, migration references, and links to `/doc` operating files.
