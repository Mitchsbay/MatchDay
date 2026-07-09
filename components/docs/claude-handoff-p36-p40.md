# Claude Handoff — P36 to P40

## P36 — Release Notes + In-App Upgrade Checklist

What changed: Added release/upgrade checklist logic and an in-app P36 checklist panel.

Why: Claude reviews now happen every five patches, so the app needs easier release verification and handoff tracking.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard preserved.

## P37 — Competition Data Quality Dashboard

What changed: Added competition data-quality checks for missing dates, TBD teams, missing scores, missing evidence, duplicate fixtures, team-name variants and orphaned tips.

Why: Custom/manual competition imports need an easy readiness check before predictions are trusted.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard preserved.

## P37.1 — Workspace Preservation Hotfix

What changed: Added stronger localStorage discovery and richest-workspace migration across all MatchDay state keys.

Why: User reported a manually added competition disappeared after patch upgrades. The app must not silently prefer defaults over richer saved data.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard preserved.

## P38 — Supabase Workspace Mirror / Cloud-First Preservation

What changed: Added workspace preservation helpers and stronger Supabase mirroring for full workspace payloads, including competitions, fixtures, tips, aliases, presets and model logs.

Why: localStorage alone is not safe enough for manual competitions. Supabase should become the normal cloud mirror while localStorage remains backup/rescue.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard preserved.

## P39 — Workspace Recovery Vault

What changed: Added local recovery snapshots before reset/import/restore actions, automatic snapshots when workspace shape changes, and a P39 Recovery Vault panel.

Why: Users need rollback checkpoints for accidental resets, bad imports, wrong cloud restores, and patch-to-patch storage-key issues.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard preserved.

## P40 — Cloud/Local Restore Conflict Resolver

What changed: Added `lib/workspaceRestoreResolver.ts` and a P40 Workspace Restore Conflict Resolver panel. It compares current browser workspace, Supabase preview, localStorage rescue candidates, and P39 recovery vault snapshots by fixture count, competition count, tips, aliases, tuning presets, model logs, richness score and saved timestamp.

Why: P37 exposed a data-preservation risk. P40 gives users a read-only comparison before they restore or save over any workspace copy.

Standing items: Tennis H2H left alone; alias-priority fix left alone; P28 rounding fix left alone; lockfile guard preserved.

## Review focus for Claude

Please prioritise:

1. Deployment blockers: Vercel build, package/lockfile, schema/env requirements.
2. Data-loss risks: local/cloud/vault restore behaviour, accidental blank/default overwrites, workspace key migration.
3. Correctness risks: ensure resolver is read-only and does not mutate scoring/import/probability/tennis logic.
4. Standing item preservation: Tennis H2H, alias-priority fix, P28 rounding fix, lockfile guard.
