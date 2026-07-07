# MatchDay / Tipping Gates App P20

Evidence-based tipping comp app with MS-AES-style prediction gates, fixture workflows, persistence, Supabase Auth/cloud sync, CSV import/export and fixture automation.

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
- `npm run check:lockfile` fails if internal-only registry URLs appear in `package-lock.json`.

## Supabase notes

Supabase is optional. Browser autosave and JSON backup/export still work without Supabase.

To enable cloud sync, run `supabase/schema.sql` and set:

```txt
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Proposed patch (pending review): live fixtures automation

This is a Claude-authored patch on top of P20, not an official version bump — Simon should review,
adjust, and fold it into the next numbered version as he sees fit.

- New `LiveFixturesPanel`: fetches real upcoming Premier League fixtures, season stats and recent
  form from a scheduled cron job hitting football-data.org (free tier).
- Data lands in a new `public.live_fixtures` table (see `supabase/schema.sql`) — separate from
  `matchday_workspaces`, public-read-only, written only by the cron job via the service-role key.
- Reuses the existing append/replace + confirmation + orphaned-tip cleanup pattern already used by
  CSV import and fixture generation, via a newly extracted shared helper, `applyFixtureBatch` in
  `lib/workspace.ts`.
- New env vars required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`,
  `CRON_SECRET` — see `.env.example`.
- `vercel.json` now has a `crons` entry hitting `/api/cron/fetch-fixtures` daily at 06:00 UTC.

