# MatchDay / Tipping Gates App P24.3

P24.3 adds **Teams + Fixtures workbook import** for manually managed custom competitions. This is for leagues that are not supported by football-data.org, where you maintain the competition in Excel and want the app to populate the normal fixture/prediction workflow.

## P24.3 additions

- Custom Competition Builder now recognises `.xlsx` / `.xls` workbooks with exactly two sheets:
  - `Teams`
  - `Fixtures`
- `Teams` sheet supplies team/table evidence.
- `Fixtures` sheet supplies the matches to create/update.
- The app maps team rows to fixture rows by competition/team name.
- Imported fixtures become normal MatchDay fixtures, so Quick Prediction, evidence audit, gates, picks, and leaderboards work as usual.
- Added an **Export Teams + Fixtures XLSX template** button.
- Raw one-sheet CSV/XLSX import still works.
- Prediction-ready CSV/XLSX import still works.
- Competition-scoped import modes from P24.2 remain intact.

## Required workbook format

The workbook must have sheet names exactly:

```txt
Teams
Fixtures
```

### Teams headers

```csv
competition,season,team,played,points,wins,draws,losses,gf,ga,home_played,home_points,home_wins,home_draws,home_losses,home_gf,home_ga,away_played,away_points,away_wins,away_draws,away_losses,away_gf,away_ga,form,availability_risk,notes
```

### Fixtures headers

```csv
competition,season,round,date,home_team,away_team,home_goals,away_goals,status,neutral_venue,odds_home_pct,odds_draw_pct,odds_away_pct,odds_source,head_to_head_edge,other_stats_edge,notes
```

Use `final` for completed results and include `home_goals` / `away_goals`. Use `scheduled` or `pending` for future fixtures and leave scores blank.

## Import modes

- `Append`
- `Update matching fixtures`
- `Replace imported competition only`
- `Replace entire workspace`

For weekly updates, prefer `Update matching fixtures`.

For a full refresh of one league, prefer `Replace imported competition only`.

Avoid `Replace entire workspace` unless you intentionally want to remove all competitions from the current workspace.

## Verification

```bash
npm run verify
```

Expected checks:

- public-registry lockfile guard
- TypeScript typecheck
- smoke tests
- production build
