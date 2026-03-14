# Blockers

- `npm run build` fails in this environment after successful compilation and page generation because Next.js hits `EXDEV: cross-device link not permitted` while renaming `.next/export/500.html` to `.next/server/pages/500.html`.
- This appears to be a filesystem/runtime issue rather than an application type or lint error. `npm run lint` and `npm run typecheck` both pass.
