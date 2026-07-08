# MatchDay / Tipping Gates App P27

P27 adds a **Results History + Standings View** on top of the P26 team alias / name normalisation manager.

## P27 additions

- New **Results History + Standings View** panel under the **Competition** tab.
- Competition selector for reviewing one imported league at a time.
- Results-derived league table calculated from final fixture scores in the workspace.
- Imported team evidence snapshot table using the latest team stats supplied by Teams + Fixtures workbooks, prediction-ready imports or live fixture evidence.
- Recent final results table for the selected competition.
- Summary cards for fixtures, final results, pending fixtures and team count.
- Warnings when a competition has no final results or no imported team evidence stats.

## Why it matters

For manually managed leagues such as Brasileirão Série A, you can now verify that the imported results/team evidence look sensible before relying on Quick Prediction, evidence gates or leaderboard outputs.

## Still included from P26

- Team Alias / Name Normalisation panel.
- Alias rules applied before custom competition import preview/update.
- Import preview before applying custom competition or prediction-ready imports.
- Append / update matching fixtures / replace imported competition only / replace entire workspace.
- Teams + Fixtures XLSX workbook import.
- Hardened public-registry lockfile guard.

## Recommended weekly workflow

```txt
Data & Import
→ Check Team Alias rules
→ Upload Teams + Fixtures workbook
→ Update matching fixtures
→ Review import preview and alias changes
→ Apply this import
→ Competition tab
→ Check standings/results snapshot
→ Tip Now
```

Use **Update matching fixtures** for normal weekly updates so fixture IDs and submitted tips are preserved.

## Verification

Run:

```bash
npm run verify
```

This runs the public-registry lockfile guard, TypeScript typecheck, smoke tests and production build.
