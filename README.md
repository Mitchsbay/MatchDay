# Tipping Gates App P17

Evidence-based tipping competition app built with Next.js for Vercel.

## P17 focus

P17 continues the maintainability cleanup started in P16. The previous single `app/page.tsx` had become too large, so P17 splits the main UI into focused components:

- `components/WorkspacePanels.tsx` — browser persistence and Supabase cloud sync panels
- `components/DashboardPanels.tsx` — accuracy dashboard, leaderboard, rule learning and weight tuning
- `components/FixturePanels.tsx` — fixture summary, fixture details, entrant picks and result inputs
- `components/EvidenceInputPanels.tsx` — team stats, form, availability, context, odds, evidence and gate panels

`app/page.tsx` is now primarily state orchestration, handlers, and composition.

## Verification

Run:

```bash
npm run verify
```

This checks:

```bash
npm run check:lockfile
npm run typecheck
npm run build
```

The lockfile guard fails if internal-only package mirror URLs are present.

## Vercel

The project is configured for Vercel with Node 24:

```json
"engines": {
  "node": "24.x"
}
```

Supabase remains optional. Add the public environment variables and run `supabase/schema.sql` only when cloud persistence is needed.
