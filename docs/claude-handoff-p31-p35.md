# Claude Handoff Report — P31 to P35

Base before this cycle: merged P30 with football model-tuning recommendations, P29 calibration, P28 probability rounding fix, football competition insights, alias-priority fix, and tennis gates through H2H.

This handoff is intended to let Claude review every five patches without having to diff blindly. Each patch note explicitly calls out whether the standing items were touched or left alone.

Standing items tracked in this cycle:

- Tennis H2H gate
- Alias-priority fix
- P28 probability rounding fix
- Public npm lockfile guard

---

## P31 — Tuning Sandbox / What-If Simulator

### What changed

Added a safe sandbox layer for testing model-weight changes without changing the live prediction model.

Added:

- `lib/tuningSandbox.ts`
- Analytics panel section: **P31 Tuning Sandbox / What-If Simulator**

The sandbox compares live model weights against sandbox weights and reports:

- fixtures compared
- settled fixtures
- prediction-label changes
- publish/review status changes
- published settled tips
- correct tips
- hit rate
- review-held fixtures
- average confidence
- high-confidence misses

Also added controls to copy live weights into sandbox, reset sandbox weights to defaults, and adjust sandbox weights safely.

### Why

P30 produces tuning recommendations, but directly applying them would be risky. P31 adds a what-if layer so weight changes can be tested against existing settled results before touching the live model.

### Standing items

- Tennis H2H gate: left alone / preserved
- Alias-priority fix: left alone / preserved
- P28 probability rounding fix: left alone / preserved
- Lockfile guard: left alone / preserved

### Main areas touched

- `lib/tuningSandbox.ts`
- `components/DashboardPanels.tsx`
- `app/page.tsx`
- `tests/scoring-smoke-tests.ts`
- `lib/workspace.ts`
- `README.md`
- `package.json`
- `package-lock.json`

---

## P32 — Tuning Presets + Safe Apply

### What changed

Added named tuning presets on top of the P31 sandbox.

Added:

- `lib/tuningPresets.ts`

The sandbox now supports:

- saving current sandbox weights as a named preset
- loading a preset into the sandbox
- overwriting a preset from current sandbox weights
- deleting a preset with confirmation
- exporting presets as JSON
- applying sandbox weights to the live model with confirmation

Presets persist in browser autosave, JSON backup/export, and Supabase cloud workspace payload.

### Why

P31 allowed safe testing, but not saving or promoting useful tested configurations. P32 closes that loop while keeping live weights protected by an explicit confirmation step.

### Standing items

- Tennis H2H gate: left alone / preserved
- Alias-priority fix: left alone / preserved
- P28 probability rounding fix: left alone / preserved
- Lockfile guard: left alone / preserved

### Main areas touched

- `lib/tuningPresets.ts`
- `components/DashboardPanels.tsx`
- `app/page.tsx`
- `hooks/useWorkspaceAutosave.ts`
- `hooks/useWorkspaceCloudSync.ts`
- `lib/workspace.ts`
- `tests/scoring-smoke-tests.ts`
- `README.md`
- `package.json`
- `package-lock.json`
- `app/globals.css`

---

## P33 — Tuning Change Log / Model Version History

### What changed

Added an audit/history layer for live model-tuning changes.

Added:

- `lib/modelChangeLog.ts`
- Analytics panel section: **P33 Model Change Log**

The app now records model-change entries when:

- sandbox weights are applied to live weights
- live weights are reset to defaults
- a manual live-weight snapshot is recorded

The panel shows total entries, apply/reset/snapshot counts, latest change, most frequently changed weights, and recent entries with changed keys and notes.

Change log persists in browser autosave, JSON backup/export, and Supabase cloud workspace payload.

### Why

Once P32 allowed sandbox weights to be promoted to the live model, the app needed an audit trail so tuning decisions are not silent or impossible to review later.

### Standing items

- Tennis H2H gate: left alone / preserved
- Alias-priority fix: left alone / preserved
- P28 probability rounding fix: left alone / preserved
- Lockfile guard: left alone / preserved

### Main areas touched

- `lib/modelChangeLog.ts`
- `components/DashboardPanels.tsx`
- `app/page.tsx`
- `hooks/useWorkspaceAutosave.ts`
- `hooks/useWorkspaceCloudSync.ts`
- `lib/workspace.ts`
- `tests/scoring-smoke-tests.ts`
- `README.md`
- `package.json`
- `package-lock.json`

---

## P34 — Model Version Comparison / Before-After Review

### What changed

Added a read-only comparison layer for model tuning history.

Added:

- `lib/modelVersionComparison.ts`
- Analytics panel section: **P34 Model Version Comparison**

The app can compare current live weights against:

- default model weights
- previous change-log before/after snapshots
- saved tuning presets

The comparison shows changed weight keys, before/after values, direction of change, affected gates/areas, prediction-label changes, publish/review status changes, hit-rate deltas, confidence deltas, and high-confidence miss changes.

### Why

P33 records raw model-change history, but raw logs are hard to evaluate. P34 gives a practical before/after review to see whether a past model state or preset would have helped or hurt on settled fixtures.

### Standing items

- Tennis H2H gate: left alone / preserved
- Alias-priority fix: left alone / preserved
- P28 probability rounding fix: left alone / preserved
- Lockfile guard: left alone / preserved

### Main areas touched

- `lib/modelVersionComparison.ts`
- `components/DashboardPanels.tsx`
- `app/page.tsx`
- `lib/workspace.ts`
- `tests/scoring-smoke-tests.ts`
- `README.md`
- `package.json`
- `package-lock.json`

---

## P35 — Five-Patch Handoff Documentation / Release Health Pack

### What changed

Added this handoff document for the P31–P35 review cycle and updated the app/repo version to `0.35.0`.

Added:

- `docs/claude-handoff-p31-p35.md`

Updated:

- `README.md`
- `package.json`
- `package-lock.json`
- `lib/workspace.ts` storage keys/version

### Why

The project workflow changed so Claude reviews every five patches instead of every patch. P35 creates the explicit handoff report Claude asked for: what changed, why, likely touched areas, and whether standing items were touched or left alone.

P35 is intentionally documentation/release-health focused. It does not change scoring logic, prediction logic, import logic, tennis logic, alias logic, probability rounding, or Vercel/deployment behaviour.

### Standing items

- Tennis H2H gate: left alone / preserved
- Alias-priority fix: left alone / preserved
- P28 probability rounding fix: left alone / preserved
- Lockfile guard: left alone / preserved

### Main areas touched

- `docs/claude-handoff-p31-p35.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `lib/workspace.ts`

---

## Verification expectation

Before handing this ZIP to Claude or deploying, run:

```bash
npm run verify
```

Expected pipeline:

- public-registry lockfile guard
- TypeScript typecheck
- smoke tests
- production build

## Review priority for Claude

Recommended Claude review buckets:

1. Deployment blockers: `package.json`, `package-lock.json`, `.npmrc`, `vercel.json`, env/schema changes, build/typecheck/smoke tests.
2. Standing-item preservation: tennis H2H, alias-priority specificity, P28 negative-probability rounding fix, hardened lockfile guard.
3. Tuning safety: sandbox/presets/change log/comparison should not silently mutate live weights except through confirmed actions.
4. Persistence safety: tuning presets and model change log should load safely from older backups.
5. Structural risk: no oversized single-file regression or duplicated model-evaluation logic.
