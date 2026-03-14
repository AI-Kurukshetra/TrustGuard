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
