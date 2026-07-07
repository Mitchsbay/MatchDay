# Tipping Gates App — P18

Vercel-ready Next.js app for a tipping competition with an evidence-based prediction engine.

## Current milestone

P18 adds a production smoke-test layer on top of P17's maintainability split.

### Included

- Evidence-based Quality Gate from raw team stats
- Recent Form Gate from last-game results
- Availability Gate from missing-player evidence
- Context/Motivation Gate from structured flags
- Odds/External Sanity Check Gate
- Conflict and Confidence Gates
- Result and accuracy tracking
- Rule learning dashboard
- Adjustable rule weights
- Browser autosave plus JSON backup/import
- Optional Supabase Auth and user-owned cloud workspaces
- Round management, entrant picks, and leaderboard scoring
- Split hooks/components to avoid a bloated single-file app
- Public-registry lockfile guard
- **P18 smoke tests for scoring, gate direction, results, learning, and workspace helpers**

## Run locally

```bash
npm install
npm run dev
```

## Verify before deployment

```bash
npm run verify
```

`npm run verify` runs:

```bash
npm run check:lockfile
npm run typecheck
npm run test:smoke
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Add these Vercel environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your Supabase anon public key
```

The app still works without Supabase by using browser autosave and JSON backup/import.
