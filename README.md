# MatchDay / Tipping Gates App P21

Evidence-based tipping comp app with MS-AES-style prediction gates, fixture workflows, persistence, Supabase Auth/cloud sync, CSV import/export, fixture automation and live fixture importing.

## P21 additions

- Live Fixtures panel for importing upcoming fixtures from the shared `public.live_fixtures` cache.
- Scheduled cron route at `/api/cron/fetch-fixtures`.
- football-data.org integration for upcoming fixtures, standings-derived team stats and recent form.
- Separate server-only Supabase service-role client for cron writes.
- Separate public-read `live_fixtures` table in `supabase/schema.sql`.
- Shared `applyFixtureBatch` helper now handles append/replace/orphaned-tip cleanup for CSV import, generated fixtures and live fixtures.
- Live fixture replace mode uses the same confirmation and orphaned-tip cleanup pattern as the other bulk tools.
- Live fixture mapping smoke-tested with blank fallbacks for unavailable fields.
- Lockfile guard hardened: every package `resolved` URL must use the public npm registry.
- App version updated to `0.21.0`.

## P20 additions

- Fixture Automation panel for generating fixtures from a team list.
- Single round-robin and double round-robin generation.
- Start round and competition/date-label controls.
- Append mode for safe bulk creation.
- Replace mode with confirmation and orphan-tip cleanup.
- Automatic odd-team bye handling.
- Duplicate team detection/skipping.
- Smoke-test coverage for generated fixture counts, duplicate handling, odd-team byes and unique fixture IDs.

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
