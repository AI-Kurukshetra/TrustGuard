# Progress

[2026-03-14 10:35] codex — Bootstrapped TrustGuard docs, app shell, dashboard pages, mock data model, and PRD-aligned REST endpoints.
[2026-03-14 10:35] codex — Added ESLint support, installed dependencies, and verified `npm run lint` plus `npm run typecheck` pass.
[2026-03-14 10:35] codex — Confirmed `npm run build` reaches static page generation, then fails on an environment filesystem `EXDEV` rename inside `.next`.
[2026-03-14 10:36] codex — Replaced the placeholder `doc/PRD.md` with a full markdown PRD based on the supplied TrustGuard requirements.
[2026-03-14 10:37] codex — Created root `PRD.md` from the provided fraud-platform market analysis, including feature priorities, advanced capabilities, APIs, monetization, and MVP recommendations.
[2026-03-14 10:38] codex — Expanded `doc/SCHEMA.md` into a detailed multi-tenant Supabase/Postgres schema with enums, table definitions, indexes, relationships, and RLS guidance.
[2026-03-14 10:39] codex — Added `supabase/migrations/20260314104500_initial_trustguard_schema.sql` with enums, tables, triggers, indexes, tenant membership, and row-level security policies.
[2026-03-14 10:40] codex — Added Supabase client scaffolding, switched pages/routes to a shared data layer with mock fallback, and created a second migration with deterministic demo seed data.
[2026-03-14 11:03] codex — Added `doc/ROADMAP.md` with sprint-by-sprint feature delivery plan, acceptance criteria, and commit discipline linked to the 20 core features.
[2026-03-14 11:08] codex — Implemented runtime risk rule evaluation in transaction scoring and persisted execution audit rows to `rule_executions`.
[2026-03-14 11:12] codex — Added derived velocity windows (1h/24h) and impossible-travel geolocation enrichment to transaction scoring before persistence.
[2026-03-14 11:22] codex — Added alert/case creation from high-risk decisions, webhook delivery persistence, tenant-scoped API enforcement, case lifecycle update endpoint, and API contract docs.
[2026-03-14 11:31] codex — Added `entity_lists` schema + CRUD APIs, wired whitelist/blacklist matches into scoring adjustments, and added model, identity-verification, and session biometrics APIs.
[2026-03-14 11:39] codex — Added Sprint 3 foundation pieces: `daily_risk_metrics` and `entity_connections` schema, analytics refresh/summary APIs, compliance report generation API, and graph materialization API.
[2026-03-14 11:46] codex — Added payment method validation and user risk profile refresh APIs to extend Sprint 2 trust-control coverage.
[2026-03-14 11:52] codex — Added Vitest-based unit test scaffolding for rule evaluation and heuristic scoring; lint/typecheck pass, test run blocked in sandbox by `EAI_AGAIN localhost`.
[2026-03-14 12:18] codex — Hardened API auth with bearer-token tenant membership checks, switched routes to request-scoped Supabase clients, and removed service-role fallback from request handling paths.
[2026-03-14 12:34] codex — Added missing route groups for `/auth`, `/rules`, `/webhooks`, and `/compliance` with tenant-aware role enforcement and updated API docs.
[2026-03-14 12:49] codex — Added schema + APIs for first-class `fraud_patterns`, `geographical_locations`, and `behavioral_patterns` entities with tenant RLS policies.
[2026-03-14 12:02] codex — Added `scripts/test-checklist.sh`, wired `npm run test:checklist`, and made smoke API checks optional via env flags.
[2026-03-14 12:04] codex — Added `vitest.config.ts` alias mapping for `@` to fix test import resolution of `@/lib/trustguard-data`.
[2026-03-14 12:26] codex — Installed `vercel` as a dev dependency with `pnpm` and verified CLI availability via `pnpm exec vercel --version`.
[2026-03-14 12:34] codex — Added root `README.md` documenting setup, environment variables, scripts, API surface, migrations, and project docs.
[2026-03-14 12:40] codex — Executed end-to-end local/API test matrix with real Supabase auth, confirmed core routes work, and isolated missing-table failures to unapplied later migrations in the target Supabase project.
[2026-03-14 13:26] codex — Linked Supabase project, pushed pending migrations, fixed graph materialization upsert conflicts, and re-ran targeted endpoint checks to 0 failures.
[2026-03-14 13:28] codex — Updated smoke script for idempotent inserts and validated full checklist (lint, typecheck, unit tests, smoke API) passes against local server with Supabase-backed auth.
[2026-03-14 13:41] codex — Added pricing/GTM/differentiation docs, implemented API KPI instrumentation (`api_request_metrics` + `/api/reports/kpis`), and validated live authenticated KPI responses after migration push.
[2026-03-14 13:49] codex — Added KPI pulse cards to dashboard and wired page data-loading to new server KPI summary function in `lib/trustguard-data.ts`.
[2026-03-14 13:58] codex — Added migration `20260314143000_seed_remaining_tables.sql`, fixed FK-safe fraud-pattern seeding via dynamic connection lookup, pushed migration, and verified non-zero row counts across all schema tables.
[2026-03-14 14:09] codex — Added operator signup/login/logout endpoints, auth pages, dashboard auth guard, cookie-backed merchant context, and tenant-scoped dashboard data loading for authenticated sessions.
[2026-03-14 14:23] codex — Added `integration_api_keys` migration + push, enabled API-key auth in `requireMerchantAuth`, implemented integration key CRUD endpoints and dashboard setup UI, and documented one-live-Supabase setup for local and Vercel.
[2026-03-14 14:36] codex — Fixed logout redirect from 307 to 303 (prevents POST-to-/login 405 on Vercel), added alert acknowledge API/UI action, and wired interactive case/rule action controls in dashboard pages.
[2026-03-14 15:02] codex — Added `/onboarding` first-run guide, redirected new signups there, added onboarding sidebar entry, and enriched merchant `cd973ed7-82a1-4f9e-bb88-9326f7fd2369` with full live demo entities (devices/sessions/payment methods/verification/webhooks/patterns).
[2026-03-14 15:00] codex — Audited completion status for all 20 core + 12 advanced PRD features and updated `doc/ROADMAP.md` with a phase-based roadmap for remaining scope.
[2026-03-14 15:05] codex — Started roadmap execution by integrating session-derived failed-login and behavioral anomaly signals (from `sessions` + `behavioral_patterns`) into real-time transaction scoring and rule-context snapshots.
[2026-03-14 15:11] codex — Implemented device trust profiling in `registerDevice` (novelty, stability, failed-login pressure, and recency-decay signals), persisted `devices.trust_score` + trust metadata, and exposed trust details in `/api/devices/register` responses.
[2026-03-14 15:14] codex — Added `TrustGuardJsAgent` (`lib/integrations/trustguard-js-agent.ts`) with typed methods, API-key header injection, retry/timeout handling, and `scorePayment()` helper; updated integration UI + docs with JS-based quick-start examples.
[2026-03-14 15:13] codex — Refactored `/api/payment-methods/validate` to a scored adapter model (`card_v1`, `bank_v1`, `wallet_v1`, `generic_v1`), stored validation evidence in `payment_methods.metadata.validation`, and added unit tests for card/bank/luhn flows.
[2026-03-14 15:18] codex — Added in-product API docs at `/api-docs`, centralized endpoint contracts in `lib/api-reference.ts` (including `/api/identity-verifications/:id` + `/api/identity-verifications/callback`), linked docs from onboarding/integrations/sidebar, added API-doc coverage test scaffolding, and fixed a `tests/trustguard-data.test.ts` typecheck gap (`identityVerified` field).
[2026-03-14 15:16] codex — Expanded alert delivery in scoring to infer endpoint channels (`webhook`/`email`/`slack`) and retry failed deliveries up to three attempts before marking `failed`.
[2026-03-14 15:21] codex — Added identity verification workflow APIs (`PATCH /api/identity-verifications/{id}`, `POST /api/identity-verifications/callback`) and incorporated latest verification status into transaction scoring/rule context (`identity_verified`).
[2026-03-14 15:25] codex — Added `model_deployments` migration + API (`GET/POST /api/models/deployments`) and wired transaction scoring to assign active/challenger model variants deterministically, persisting `risk_scores.model_id` and model-assignment snapshot fields.
[2026-03-14 15:29] codex — Added a live execution tracking board to `doc/ROADMAP.md` covering all core/advanced features with explicit status markers and immediate queue ordering.
[2026-03-14 15:33] codex — Added compliance scheduling (`compliance_report_schedules` migration + `/api/compliance/schedules` + `/api/compliance/schedules/run`), upgraded user risk-profile refresh to composite scoring, and added `/api/chargebacks/prevention` playbook generation.
[2026-03-14 15:37] codex — Reworked TrustGuard branding with a reusable logo component across auth/dashboard surfaces and added `app/icon.svg` for browser/app icon consistency.
[2026-03-14 15:39] codex — Made the dashboard sidebar sticky on desktop and improved UX with grouped nav sections, stronger active-state cues, and quick-access setup/API docs links.
[2026-03-14 15:41] codex — Added a mobile navigation drawer (`Menu` toggle + overlay/escape close + body scroll lock) and kept desktop sticky sidebar behavior for large screens.
[2026-03-14 15:44] codex — Added smooth drawer open/close animation and touch swipe-to-close for mobile sidebar, with shared sidebar navigation reused for drawer and desktop.
[2026-03-14 15:47] codex — Fixed strict TS issues in `lib/advanced-intelligence.ts` (literal-union impact typing + tuple-typed modality scores), returning `pnpm typecheck` to green.
[2026-03-14 15:48] codex — Completed remaining core + advanced scope: added advanced-intelligence migration, graph/channel/historical/contextual-auth APIs, full advanced feature API suite, dynamic-threshold + contextual-auth scoring integration, and updated roadmap/status tracking docs.
[2026-03-14 15:59] codex — Improved onboarding UX in Rules/Alerts/Cases by adding guided rule creation, alert and case queue summaries/filters, and plain-language next-step guidance for new analysts.
[2026-03-14 16:06] codex — Simplified main dashboard UX by adding priority focus cards, collapsing secondary metrics, replacing static workload text with live counts, and limiting queues to top 5 items with clear view-all actions.
[2026-03-14 16:40] codex — Implemented monetization controls: billing usage events + quota overrides migration, plan entitlement library, transaction/API quota checks, advanced-feature plan gating, billing APIs, and dashboard scorecard page.
[2026-03-14 16:45] codex — Added automated quota-threshold notifications (85%/100%) via `billing_usage_notifications`, wired alert creation into transaction scoring, exposed notification records in `/api/billing/usage`, and surfaced quota notices on `/scorecard`.
