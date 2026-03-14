# Blockers

- `npm run build` fails in this environment after successful compilation and page generation because Next.js hits `EXDEV: cross-device link not permitted` while renaming `.next/export/500.html` to `.next/server/pages/500.html`.
- This appears to be a filesystem/runtime issue rather than an application type or lint error. `npm run lint` and `npm run typecheck` both pass.
- `npm run test` currently fails in this sandbox with `getaddrinfo EAI_AGAIN localhost` during Vitest startup. Test suite should be run in a normal local/CI runtime.

[2026-03-14] RESOLVED — codex
Problem:   Supabase-backed API matrix showed multiple endpoints failing with `PGRST205` table-missing errors (`entity_lists`, `daily_risk_metrics`, `entity_connections`, `fraud_patterns`, `geographical_locations`, `behavioral_patterns`).
Attempted: Verified failures through Next API responses and direct Supabase REST checks using both authenticated user token and service-role token.
Needs:     Completed — linked project and pushed pending migrations (`20260314114000_add_entity_lists.sql`, `20260314120000_add_analytics_and_graph.sql`, `20260314124000_add_patterns_geo_behavior_entities.sql`); endpoint retest passed.
