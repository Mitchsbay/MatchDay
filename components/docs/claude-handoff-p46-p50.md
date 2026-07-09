# Claude Handoff — P46 to P50

## Base and safety note

Base used for this patch: Claude's latest post-P45 repo package (`tipping-gates-app-for-simon.zip`), which included whole-app admin login and Supabase recovery-vault mirroring. The tennis side was treated as protected and was not modified.

## P46 — Advanced Data Weight Controls / Conservative Integration Toggle

### What changed

- Added `lib/advancedDataWeightControls.ts`.
- Added a persisted `advancedDataControls` workspace setting.
- Added an Analytics panel named **P46 Advanced Data Weight Controls**.
- Extended the prediction model so advanced data remains review-only by default.
- When explicitly enabled, advanced data can only adjust confidence, within a capped range.
- The advanced-data overlay cannot change home/draw/away edge, core prediction side, tennis gates, aliases, or probability rounding.
- Added smoke-test coverage for review-only default behaviour, capped confidence-only influence, and unchanged model edge.

### Why

P45 measured advanced data usefulness, but did not allow safe live influence. P46 creates a conservative bridge: advanced evidence can be tested in live confidence workflows only when deliberately enabled, with guardrails.

### Files/areas touched

- `lib/advancedDataWeightControls.ts`
- `hooks/usePredictionModel.ts`
- `components/DashboardPanels.tsx`
- `app/page.tsx`
- `lib/workspace.ts`
- `hooks/useWorkspaceAutosave.ts`
- `hooks/useWorkspaceCloudSync.ts`
- `tests/scoring-smoke-tests.ts`
- `README.md`
- `package.json`, `package-lock.json`

### Standing items

- Tennis H2H gate: left alone / preserved
- Tennis side generally: left untouched
- Alias-priority fix: left alone / preserved
- P28 probability rounding fix: left alone / preserved
- Lockfile guard: left alone / preserved
- Whole-app admin login gate: left alone / preserved
- Recovery vault Supabase mirror anti-nesting constraint: preserved

### Version

0.46.0

### Verification

- `npm run typecheck` passed
- `npm run test:smoke` passed
- `npm run build` compiled and generated routes successfully in this container, but the local Next.js process did not return before the tool timeout after final route output. Re-run on the deployment machine / Vercel as part of normal release verification.

## Suggested P47

P47 should compare review-only vs advanced-data-enabled predictions using P45 calibration history before any further live influence is allowed. Keep the advanced-data toggle off by default unless the calibration sample is strong enough.


## P47 — Advanced Data Weight Sandbox / Calibration Integration

What changed:
- Added `lib/advancedDataWeightSandbox.ts` for read-only comparison of review-only baseline vs current P46 confidence-only settings.
- Added an Analytics panel named **P47 Advanced Data Weight Sandbox / Calibration Integration**.
- The panel reports settled sample size, review-only vs advanced sandbox hit rate, net correct delta, confidence moves, review escalations, protected misses, blocked correct tips, and a cautious recommendation.
- Added smoke-test coverage for the sandbox summary.

Why:
- P46 created a guarded toggle. P47 makes it possible to test that toggle against settled fixtures before trusting advanced data in live confidence decisions.

Files/areas touched:
- `lib/advancedDataWeightSandbox.ts`
- `hooks/usePredictionModel.ts`
- `components/DashboardPanels.tsx`
- `app/page.tsx`
- `tests/scoring-smoke-tests.ts`
- `README.md`
- `package.json` / `package-lock.json`
- `lib/workspace.ts` storage key rollover

Standing items:
- Tennis H2H gate: left alone / preserved.
- Alias-priority fix: left alone / preserved.
- P28 probability rounding fix: left alone / preserved.
- Lockfile guard: left alone / preserved.

Version: 0.47.0
Verification:
- npm run check:lockfile passed.
- npm run typecheck passed.
- npm run test:smoke passed.
- npm run build passed separately.
- Full chained npm run verify completed check/typecheck/smoke and printed successful build output, but the container command timed out after Next.js final route output rather than exiting cleanly.

## P47.1 — Custom Competition Import Mode Clarity

### What changed
- Clarified the Custom Competition Builder import buttons so the safe new-league path is now labelled **Add as new competition / append safely**.
- The import preview now separates imported competition scope into:
  - competitions that will be added as new;
  - competitions that already exist in the workspace.
- The primary preview action now reflects the selected mode instead of the vague “Apply this import”.
- Added safer preview messaging for append/add-new, update, replace imported competition, and replace-entire-workspace modes.
- Added smoke-test coverage for brand-new competition detection and existing-competition append warnings.

### Why
The P47 UI made a new competition import look like a replace/update action. This was confusing when importing a new USL Championship workbook into a workspace that already contained another competition. P47.1 makes the non-destructive add-new path explicit and makes the preview show whether any existing competition will be touched.

### Standing items
- Tennis H2H gate: left alone / preserved.
- Alias-priority fix: left alone / preserved.
- P28 probability rounding fix: left alone / preserved.
- Lockfile guard: left alone / preserved.

### Version
- 0.47.1
