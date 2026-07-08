# MatchDay / Tipping Gates App P24

P24 adds a **Custom Competition Builder + Raw Results/XLSX Import** layer on top of the P23.3 app.

## P24 additions

- Import unsupported football competitions that are not available through football-data.org.
- Upload a raw CSV or XLSX file containing match results and upcoming fixtures.
- The app calculates:
  - played / points / wins / draws / losses
  - goals for / goals against
  - home split stats
  - away split stats
  - recent form before each fixture
- Imported rows become normal MatchDay fixtures, so Quick Prediction, Evidence Audit, gates, leaderboard and cloud/browser persistence continue to work as usual.
- Added a raw results template export for custom competitions.
- Keeps the existing prediction-ready CSV import for advanced workflows.

## Raw competition import columns

Required:

```csv
competition,round,date,home_team,away_team,home_goals,away_goals,status
```

Accepted status values include `final`, `scheduled`, `postponed`, and `cancelled`.

Example:

```csv
competition,round,date,home_team,away_team,home_goals,away_goals,status
Brasileirao Serie A,Round 1,2026-04-12,Botafogo,Santos,2,1,final
Brasileirao Serie A,Round 1,2026-04-12,Flamengo,Palmeiras,1,1,final
Brasileirao Serie A,Round 2,2026-04-19,Botafogo,Palmeiras,,,scheduled
```

Optional raw import columns:

```csv
odds_home_pct,odds_draw_pct,odds_away_pct,odds_source,head_to_head_edge,other_stats_edge
```

## Existing features retained

- P23.3 tabbed layout.
- Quick Prediction panel.
- Football live fixture cache and admin maintenance.
- Tennis quick prediction and surface gate work.
- Fixture generator.
- Prediction-ready CSV import/export.
- Browser autosave.
- Supabase Auth + cloud workspace save/load.
- Evidence readiness audit.
- Rule learning and rule tuning.
- Hardened public npm lockfile guard.

## Verify

```bash
npm run verify
```

This runs:

```bash
npm run check:lockfile
npm run typecheck
npm run test:smoke
npm run build
```
