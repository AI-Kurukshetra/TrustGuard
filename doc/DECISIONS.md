# Decisions

## 2026-03-14

- Use a mocked local data layer first so the product surface and information architecture can be validated before Supabase integration.
- Model the MVP around dashboard pages and REST endpoints named directly from the PRD to keep future backend wiring straightforward.
- Use a dark, security-analytics visual system with cyan and amber accents to fit the TrustGuard domain and keep high-risk states legible.
- Enable Next typed routes and make navigation conform to them so routing errors surface at compile time instead of later in QA.
- Use a multi-tenant schema keyed by `merchant_id` so TrustGuard can support SaaS isolation cleanly from the first Supabase-backed version.
- Map internal dashboard operators through `merchant_members` linked to `auth.users` so Supabase RLS can enforce tenant access and role-based permissions without mixing analysts with monitored end-user accounts.
- Until dashboard auth is implemented, allow server-only Supabase reads to fall back to the service-role client so the UI can be wired to real data without exposing elevated credentials to the browser.
