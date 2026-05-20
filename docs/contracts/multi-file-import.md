# Multi-File Import

Status: Implemented; pending manual verification
Branch: feature/multi-file-import

## Goal

Allow import workflows to process multiple selected files while preserving the current single-file behavior and keeping each importer responsible for its own data rules.

## Scope

Multi-file import applies to:

- Logs: LAS and delimited text files, mixed in one selection.
- Tops CSV/TSV/TXT.
- Deviation CSV/TSV/TXT.
- Wells CSV/TSV/TXT.
- StratChart CSV/TSV/TXT.
- Sea level curve CSV/TSV/TXT.

## Required Behavior

- Existing single-file imports must keep working.
- The file picker must support selecting multiple files.
- Native file picking must keep `tkinter` isolated in a subprocess.
- The import wizard should process files sequentially.
- Preview must clearly show the current file, for example `File 2 of 5`.
- The user confirms/imports the current file, then the wizard advances to the next file.
- At the end, show a summary with imported, failed, and skipped files.
- Per-file errors should not crash the whole wizard.
- Logs may mix LAS and delimited text files; file type is detected per file.
- Tabular import mapping is initially per file. Shared mapping can be considered later only if the UX proves safe.
- Multi-well CSV behavior remains data-driven and independent from multi-file behavior.

## Architecture Notes

- Add file-list picking as a path-picker capability, not as importer-specific backend logic.
- Keep queue/progress state in the frontend import wizard layer.
- Keep backend import endpoints mostly single-file in the first implementation; the frontend orchestrates sequential imports.
- Do not mix import orchestration with persistence, rendering, or model calculation modules.
- Extract shared multi-file queue/status UI only when at least two importers use the same pattern.

## Implementation Plan

1. Add backend `pick-files` endpoint and frontend `pickFiles()` helper. Done.
2. Add a small shared multi-file queue/progress helper for import dialogs. Done.
3. Implement multi-file logs first because it has mixed LAS/CSV file-type detection. Done.
4. Add summary UI for completed multi-file runs. Done.
5. Extend the same sequential workflow to tops, deviation, wells, StratChart, and sea level curve imports. Done.
6. Add focused frontend tests for queue progression and summary behavior. Done.
7. Run backend picker/import tests where backend behavior changes. Done.

## Post-Verification Fixes

These fixes are part of the same multi-file/import mapping UX work and should be implemented as small sequential commits with focused tests after each object or shared shell change.

### A. Wizard Footer Actions

Status: Done.

- Move `Skip this file` out of importer preview bodies and into the shared wizard footer.
- In multi-file preview steps, show `Skip this file` immediately to the left of `Cancel`.
- Summary is a terminal state: do not show `Back` or `Cancel`.
- Summary should show a single close action, labelled `Close`, because there is nothing left to cancel after files have been processed.
- Implement this in `ImportWizardShell` through explicit footer action props so individual importers do not hand-roll button placement.

### B. Log Depth Reference UX

Status: Done.

- LAS preview:
  - Do not show inactive `depth` text in the Type column.
  - Show the detected depth reference as `MD`, `TVD`, or `TVDSS`.
  - Default to `MD` for generic LAS depth mnemonics such as `DEPTH`/`DEPT`.
  - Use `TVD`/`TVDSS` only when the LAS depth mnemonic/header explicitly says so.
- CSV logs preview:
  - Keep the auto-detected depth mapping visible in the mapping row, for example `MD *`.
  - Add a depth-reference dropdown below the mapped depth column with `MD`, `TVD`, and `TVDSS`.
  - Default to `MD` for generic `DEPTH`/`DEPT`.
  - Default to `TVD` or `TVDSS` only when the source header explicitly says so.
  - Submit the selected value as `trusted_depth_reference`.

### C. Column Role Mapping For Attributes

Status: Done.

- For importers that preserve unmapped columns as user attributes, the preview table should use two header layers:
  - Source header row: original column names from the file.
  - Mapping row below it: dropdown for the import role of each source column.
- The mapping dropdown auto-selects a predefined/canonical attribute when the source column name matches an alias.
- If the source column does not match a predefined attribute and the importer supports extra attributes, the dropdown defaults to `user`.
- The dropdown must allow reassignment:
  - Any predefined/canonical attribute can be selected for any column.
  - `user` means import this column as a user-defined extra attribute using the source column name as the attribute key.
  - `-` means do not import this column.
- Predefined/canonical labels should be domain labels such as `Depth`, `Formation name`, `Well name`, `Age (Ma)`, etc.
- Round-trip rule:
  - If a source column such as `index` is mapped to a predefined attribute such as `Unit code`, it must be stored/exported as the canonical field (`unit_code`) and auto-detected as `Unit code` on re-import.
  - If the same source column is mapped to `user`, it remains a user attribute keyed by the source column name (`index`) and must not be exported as a predefined canonical field.
- Apply this consistently to all tabular importers that preserve extra attributes:
  - Tops.
  - Wells.
  - StratChart.
  - Sea level curve.
- Deviation preserves only numeric extra columns in the deviation parquet. For numeric extra columns, default to `user`; for nonnumeric unmatched columns, default to `-`.
- Logs CSV is different: unmapped numeric/log columns are imported as curves, so their dropdown labels should remain curve mnemonics rather than `user:`.
- LAS is different: well-header metadata is imported from the LAS header, not from the tabular mapping UI.

### D. Test Plan For Fixes

Status: Done.

- Add or update frontend tests for:
  - Footer button order and summary close-only behavior.
  - LAS generic depth mnemonic -> `MD`.
  - LAS explicit `TVD`/`TVDSS` mnemonic -> matching depth reference.
  - CSV log depth dropdown default and submit payload.
  - `user: <column name>` labels for extra-attribute importers.
- Run the focused import wizard tests after each stage.

## Non-Goals

- No bulk backend import endpoint in the first implementation.
- No schema changes.
- No shared mapping across files until manually reviewed after the sequential workflow is stable.
