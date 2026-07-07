# Tipping Gates App P19

Evidence-based tipping comp app with MS-AES-style gates, local/browser persistence, optional Supabase Auth cloud persistence, rounds, leaderboards, smoke tests, and CSV fixture workflows.

## P19 additions

- Fixture CSV export template
- Fixture CSV import in append mode
- Fixture CSV import in replace mode
- Bulk spreadsheet management for:
  - competition, round, date, home/away teams
  - home/away season stats
  - home/away venue splits
  - recent form strings such as `W:2-1;D:1-1;L:0-2`
  - market probabilities
  - final result status and score
  - simple manual gate fields
- CSV smoke-test coverage added to `npm run verify`

## Run locally

```bash
npm install
npm run dev
```

## Verify before deployment

```bash
npm run verify
```

This runs the public-registry lockfile guard, TypeScript typecheck, smoke tests, and production build.

## Vercel notes

- Node is pinned to `24.x` in `package.json`.
- `.npmrc` forces the public npm registry.
- `npm run check:lockfile` fails if internal-only registry URLs appear in `package-lock.json`.
