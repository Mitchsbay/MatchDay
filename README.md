# MatchDay / Tipping Gates App P23.2

Evidence-based tipping comp app with MS-AES-style prediction gates, fixture workflows, persistence, Supabase Auth/cloud sync, CSV import/export, fixture automation, live fixture importing, live fixture maintenance and evidence readiness auditing.


## P23.2 additions

- Evidence Readiness Audit panel for selected-round or all-round fixture review.
- Fixture-level completeness scoring across Quality, Form, Availability, Context, Odds and Result inputs.
- Active fixture summary now shows evidence readiness percentage, source type and the top blocker/warning.
- New `lib/evidenceAudit.ts` keeps evidence-readiness logic separate from the prediction engine.
- Smoke-test coverage for evidence audit classification and summary calculations.
- App version updated to `0.23.2`. P23 local-storage/cloud workspace keys are retained because this is a UI/source-label patch, with P22/P21 legacy fallback preserved.

## P22 additions

- Live Fixture Maintenance panel for admin-only cache checks, manual refresh and stale-row cleanup.
- New secured admin route at `/api/admin/live-fixtures` using the existing `CRON_SECRET` bearer token.
- Cron route now also deletes stale `public.live_fixtures` rows after a successful refresh.
- Shared server-side live fixture sync helper extracted into `lib/liveFixtureSync.ts` so cron/manual refresh use the same code path.
- New `lib/liveFixtureMaintenance.ts` for cache status summaries and cleanup logic.
- P22 smoke-test coverage for cache summaries and stale-row cutoff logic.
- App version updated to `0.22.0` with P22 local-storage keys and P21 legacy fallback preserved.

## P21 additions

- Live Fixtures panel for importing upcoming fixtures from the shared `public.live_fixtures` cache.
- Scheduled cron route at `/api/cron/fetch-fixtures`.
- football-data.org integration for upcoming fixtures, standings-derived team stats and recent form.
- Separate server-only Supabase service-role client for cron writes.
- Separate public-read `live_fixtures` table in `supabase/schema.sql`.
- Shared `applyFixtureBatch` helper handles append/replace/orphaned-tip cleanup for CSV import, generated fixtures and live fixtures.
- Lockfile guard hardened: every package `resolved` URL must use the public npm registry.

## Verify before deployment

```bash
npm ci --no-audit --no-fund --progress=false
npm run verify
```

`npm run verify` runs:

```bash
npm run check:lockfile
npm run typecheck
npm run test:smoke
npm run build
```

## Vercel notes

- Keep files at the repository root, not inside a nested app folder.
- Node is pinned to `24.x` in `package.json`.
- `.npmrc` forces the public npm registry.
- `npm run check:lockfile` fails if package-lock contains internal-only or non-public npm resolved URLs.
- `vercel.json` schedules the live fixture cron daily at 06:00 UTC.
- `/api/admin/live-fixtures` uses the same `CRON_SECRET` as the scheduled cron route. The secret is typed into the admin panel when needed; it is not stored in workspace state or exposed by environment variables prefixed with `NEXT_PUBLIC_`.

## Supabase notes

Supabase is optional for browser autosave and JSON backup/export, but live fixtures require Supabase because the cron job writes into `public.live_fixtures`.

To enable cloud sync and live fixtures, run `supabase/schema.sql` and set:

```txt
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FOOTBALL_DATA_API_KEY=...
CRON_SECRET=...
```

The service role key is server-only and must never be exposed to the browser.

## P23.2 tab restructuring

- Adds a tab bar after round management: Tip Now, Evidence, Data & Import, and Analytics & Admin.
- Keeps the day-to-day tipping flow on the default Tip Now tab.
- Moves evidence entry, bulk tools, and analytics/admin panels off the main scroll path.
- Evidence tab shows the active fixture evidence completeness badge.
- Includes P23.1 source-label fix: generated fixture IDs are now recognized as Manual/generated fixtures instead of Workspace/sample fixtures.
