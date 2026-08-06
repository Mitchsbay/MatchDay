# MatchDay / Tipping Gates App P38

P38 adds **Supabase Workspace Mirror / Cloud-First Preservation** after the P37.1 data-preservation hotfix. The goal is simple: manual competitions, imported fixtures, tips, tuning presets and model logs should be saved to both Supabase and localStorage, with guards that stop a weaker/default workspace from silently overwriting a richer one.

## P38 additions

- Added `lib/workspacePreservation.ts`.
- Updated cloud sync so the full workspace can mirror automatically to Supabase after local state has loaded.
- Added richer/weaker workspace comparison before Supabase overwrites.
- Added manual-save confirmation when the existing cloud workspace appears richer than the browser workspace.
- Added restore-from-cloud warning when the browser backup appears richer than the Supabase copy.
- Added visible cloud mirror status and last cloud save time in the cloud persistence panel.
- Updated workspace storage keys to P38 while preserving P37.1/P37/P36/P35/P34/P33/P32/P31 and older fallbacks.
- Extended the P36–P40 Claude handoff report.

## Behaviour

P38 saves important workspace data to:

1. Supabase cloud workspace payload, when Supabase is configured and the user is signed in.
2. localStorage browser backup, as a fallback/rescue copy.

P38 protects:

- custom/manual competitions
- fixtures and results
- entrants and user tips
- team aliases
- tuning presets
- model change log entries
- selected workspace state

## Standing items

P38 intentionally leaves these alone and preserved:

- Tennis H2H gate
- Alias-priority fix
- P28 probability rounding fix
- Lockfile guard

## Verification

Run:

```bash
npm run verify
```

Expected pipeline:

- public-registry lockfile guard
- TypeScript typecheck
- smoke tests
- production build


## P40 Workspace Restore Conflict Resolver

P40 adds a read-only resolver that compares the current browser workspace, refreshed Supabase preview, localStorage rescue candidates, and P39 recovery vault snapshots. It recommends the safest/richest source before you restore or save over anything. This is designed to prevent manual competitions from disappearing during patch upgrades or cloud/local conflicts.

## P39 Workspace Recovery Vault

P39 adds a local recovery vault so important workspace states can be restored after accidental reset/import/restore actions or storage-key migration issues. The vault stores automatic snapshots when the workspace shape changes, plus protected snapshots before destructive actions. It is a browser-local safety net that complements P38 Supabase mirroring.

## P41 — Advanced Evidence Schema + Accuracy Data Fields

P41 adds the schema foundation for richer football accuracy inputs without aggressively changing prediction scoring. New advanced evidence fields cover xG, strength of schedule, rest/fatigue, player-impact availability, market movement, set pieces, discipline/card risk, and team stability/context.

Standing items: Tennis H2H, alias-priority matching, P28 probability rounding, and the lockfile guard were left alone/preserved.

## P42 — Advanced Evidence Import Templates

P42 connects the P41 advanced evidence schema to the import/export workflow. Prediction-ready CSV/XLSX exports now include optional advanced evidence columns, and imports preserve those fields on fixtures. The Teams + Fixtures workbook template now includes optional team-level advanced evidence columns on the Teams sheet and match-level advanced evidence columns on the Fixtures sheet. Raw single-sheet competition imports can also include prefixed home_/away_ advanced evidence fields plus match movement fields.

P42 remains conservative: it stores and displays richer accuracy inputs but does not auto-change model scoring yet.

## P43 — Advanced Evidence Impact Signals

P43 turns imported advanced evidence into read-only review signals. It checks xG edge, strength of schedule, fatigue/congestion, player-impact availability, market movement, set-piece profile, discipline/card risk, neutral venue/weather and stability flags.

P43 remains conservative: it does **not** change live prediction scoring, weights, probability rounding, tennis gates, aliases, import alias matching or published tips. It simply tells the user which fixtures deserve extra review before a future Advanced Data Gate is allowed to influence predictions.

Standing items: Tennis H2H, alias-priority matching, P28 probability rounding, and the lockfile guard were left alone/preserved.

## P44 — Advanced Data Gate

P44 adds a conservative Advanced Data Gate using the P41–P43 advanced evidence foundation. It reviews xG, schedule strength, fatigue, player-impact availability, market movement, set pieces, discipline and advanced context flags.

The gate is advisory and review-focused. It can support, weaken or flag the current prediction, but it does not replace the core prediction model, auto-change rule weights, alter probability rounding, touch tennis H2H, or change team alias matching.

## P45 — Advanced Data Calibration Review

P45 adds an advisory calibration panel for the advanced evidence work introduced in P41-P44. It compares settled fixtures against P43 impact signals and P44 Advanced Data Gate verdicts. It does not auto-retune rule weights.

Claude handoff report: `docs/claude-handoff-p41-p45.md`.

## P46 — Advanced Data Weight Controls / Conservative Integration Toggle

P46 adds an explicit Advanced Data Weight Controls panel in Analytics. Advanced data remains review-only by default. When the toggle is enabled, advanced evidence can only adjust prediction confidence within a capped range; it cannot change the core home/draw/away edge, prediction side, tennis gates, team aliases, or P28 probability rounding behaviour.

The controls are persisted with the workspace, mirrored through the existing cloud workflow, and protected by smoke tests. This patch builds on Claude's post-P45 admin-auth and recovery-vault sync work while leaving the tennis side untouched.


## P47 — Advanced Data Weight Sandbox / Calibration Integration

P47 adds a read-only Analytics sandbox that compares review-only baseline behaviour against the current P46 confidence-only advanced-data settings. It shows settled-fixture hit rates, net correct delta, confidence movement, review escalations, protected misses, and potentially blocked correct tips before relying on the live toggle.

The sandbox is a safety layer only. It does not auto-apply model tuning, does not increase the confidence cap, does not change home/draw/away edge logic, and leaves tennis gates/scoring untouched. It is intended to be reviewed alongside P45 calibration before any live confidence influence is trusted.
