# Claude Handoff — P41 to P45

## P41 — Advanced Evidence Schema + Accuracy Data Fields

Added the storage foundation for richer football accuracy inputs: xG, strength of schedule, rest/fatigue, player-impact availability, market movement, set pieces, discipline/card risk and team stability/context.

Why: the app needed richer predictive inputs before making any stronger accuracy claims.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard left alone.

## P42 — Advanced Evidence Import Templates

Added CSV/XLSX/workbook support for the P41 advanced evidence fields.

Why: advanced evidence needs to be importable from real spreadsheets before it can be useful.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard left alone.

## P43 — Advanced Evidence Impact Signals

Added read-only signals for xG, schedule, fatigue, player impact, market movement, set pieces, discipline and context volatility.

Why: this surfaces advanced evidence as warnings without changing live prediction scoring.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard left alone.

## P44 — Advanced Data Gate

Added a conservative Advanced Data Gate that supports, weakens or flags the current prediction based on advanced evidence.

Why: P44 turns advanced evidence into a controlled gate without replacing the existing model.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard left alone.

## P45 — Advanced Data Calibration Review

Added `lib/advancedDataCalibration.ts` and a P45 analytics panel to review whether advanced signals/gates helped or warned correctly on settled fixtures.

Why: before advanced evidence influences the model more strongly, the app needs to measure whether those signals are useful.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard left alone.
