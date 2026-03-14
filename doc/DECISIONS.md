# Decisions

## 2026-03-14

- Use a mocked local data layer first so the product surface and information architecture can be validated before Supabase integration.
- Model the MVP around dashboard pages and REST endpoints named directly from the PRD to keep future backend wiring straightforward.
- Use a dark, security-analytics visual system with cyan and amber accents to fit the TrustGuard domain and keep high-risk states legible.
- Enable Next typed routes and make navigation conform to them so routing errors surface at compile time instead of later in QA.
- Use a multi-tenant schema keyed by `merchant_id` so TrustGuard can support SaaS isolation cleanly from the first Supabase-backed version.
- Map internal dashboard operators through `merchant_members` linked to `auth.users` so Supabase RLS can enforce tenant access and role-based permissions without mixing analysts with monitored end-user accounts.
- Until dashboard auth is implemented, allow server-only Supabase reads to fall back to the service-role client so the UI can be wired to real data without exposing elevated credentials to the browser.
- Add a single pre-commit checklist command (`npm run test:checklist`) that always runs lint/typecheck/unit tests and only runs API smoke tests when required credentials are present or `RUN_SMOKE=always`.
- Use an explicit Vitest config alias (`@` -> project root) to keep test import behavior aligned with Next.js `tsconfig` path aliases.
- Treat Supabase table-missing (`PGRST205`) errors as migration-state blockers and require applying pending SQL migrations before continuing API QA.
- In graph materialization, aggregate duplicate relationship keys within the request and upsert one row per conflict key to avoid Postgres multi-update conflicts.
- Keep smoke test requests idempotent by injecting per-run unique suffixes for routes with unique-key constraints.
- Install the Vercel CLI as a local dev dependency (`pnpm exec vercel`) so deployment commands are version-pinned per repository rather than relying on a global install.
- Keep onboarding instructions in a root `README.md` that points to `/doc` files for deeper specifications, so setup and operational context stay easy to discover for new contributors.
- Track API SLO and KPI inputs in a dedicated `api_request_metrics` table (tenant-scoped, RLS-protected) to support operational reporting without coupling to app logs.
- KPI endpoint should return explicit assumptions when precision/recall or drift are estimated from proxy signals, rather than implying label-quality certainty.
- Start GTM/pricing execution artifacts as first-class repo docs (`PRICING`, `GTM`, `DIFFERENTIATION_BACKLOG`) so commercial decisions evolve alongside product implementation.
