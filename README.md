# MatchDay / Tipping Gates App P26

P26 adds a **Team Alias / Name Normalisation Manager** on top of the P25 import preview gate.

## P26 additions

- New Team Alias / Name Normalisation panel under **Data & Import**.
- Alias rules are applied to custom competition imports before preview/apply.
- Helps weekly spreadsheets match existing fixtures when names vary, for example:
  - `Sao Paulo` → `São Paulo`
  - `Gremio` → `Grêmio`
  - `Vitoria` → `Vitória`
  - `Atletico MG` → `Atlético MG`
- Alias rules can be scoped to one competition or applied globally.
- Alias rules are saved in browser autosave, JSON backups and Supabase cloud workspace payloads.
- The import preview now includes alias-applied warnings so you can see when names were normalised before applying.
- Workspace can be normalised manually with **Apply aliases to current workspace**.
- The panel also warns when obvious same-team spelling variants are already present in the workspace.

## Still included from P25

- Import preview before applying custom competition or prediction-ready imports.
- Append / update matching fixtures / replace imported competition only / replace entire workspace.
- Tip-risk and duplicate-row preview.
- Teams + Fixtures XLSX workbook import.
- Hardened lockfile guard.

## Recommended weekly workflow

```txt
Data & Import
→ Check Team Alias rules
→ Upload Teams + Fixtures workbook
→ Update matching fixtures
→ Review import preview and alias changes
→ Apply this import
```

Use **Update matching fixtures** for normal weekly updates so fixture IDs and submitted tips are preserved.

## Verification

Run:

```bash
npm run verify
```

This runs the public-registry lockfile guard, TypeScript typecheck, smoke tests and production build.
