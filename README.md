# MatchDay / Tipping Gates App P25

P25 adds an **Import Preview + Safe Weekly Update** gate on top of the P24.3 Teams + Fixtures workbook importer.

## P25 additions

- Uploading a custom competition workbook or prediction-ready CSV/XLSX now shows a preview before applying changes.
- Preview shows:
  - import mode
  - imported fixture count
  - imported competition scope
  - matching fixtures that will update
  - new fixtures that will be added
  - existing fixtures that will be preserved
  - final workspace fixture count
  - tips preserved
  - tips at risk / orphaned
  - duplicate fixture rows inside the import file
- Destructive actions now happen after preview, not immediately on file selection.
- Replace and replace-competition modes still require a final confirmation when applying the preview.
- Existing P24.3 Teams + Fixtures XLSX import remains supported.
- Existing P24.2 import modes remain supported:
  - Append
  - Update matching fixtures
  - Replace imported competition only
  - Replace entire workspace

## Recommended weekly workflow

For weekly league updates, use:

```txt
Custom Competition Builder
→ Upload Teams + Fixtures workbook
→ Update matching fixtures
→ Review preview
→ Apply this import
```

Use **Replace imported competition only** only when you intentionally want to refresh that league's fixtures without touching other competitions.

Use **Replace entire workspace** only after exporting a JSON backup.

## Verification

Run:

```bash
npm run verify
```

This runs the public-registry lockfile guard, TypeScript, smoke tests, and the production build.
