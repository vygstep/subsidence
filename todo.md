# SUBSIDENCE TODO

This file contains only active work that still needs to be done.

Rules:

- Every todo item must link to an active contract in `docs/contracts/`.
- Completed items are removed from this file.
- Completed contracts are moved to `docs/contracts/implemented/`.
- Historical or completed work must not remain here as checked-off clutter.

---

## Active Contracts

- [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md)
- [1D Well Model Architecture](docs/contracts/well_1d_model_architecture.md)
- [1D Well Model Summary](docs/contracts/well_1d_model_summary.md)

---

## Current Work

- [ ] Execute `M6 Safe refactoring pass` from [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md).
- [ ] Execute `M7 Resume UX and feature backlog` from [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md).

---

## M6 Safe Refactoring Plan

Goal:

- Reduce maintenance risk without changing behavior or API paths.
- Keep each refactor small enough to review and revert independently.
- Run tests after every extraction step.

Non-goals:

- Do not change project file format.
- Do not redesign UI.
- Do not change import semantics.
- Do not combine bugfixes with pure refactors unless a test exposes a real blocker.

Required checks after every backend step:

```bash
cd app
pytest tests
```

Required checks after every frontend step:

```bash
cd frontend
npm run test -- --run
npm run build
```

### M6.1 Backend API route/service seams

Target files:

- `app/src/subsidence/api/projects.py`
- New helper/service files only if they reduce route density clearly.

Steps:

- [ ] Extract project lifecycle helpers from `projects.py`: create/open/close/save/status/recent/path picker.
- [ ] Extract import route helpers from `projects.py`: LAS, logs CSV, tops, unconformities, deviation.
- [ ] Extract checkpoint/export/visual-config helpers from `projects.py`.
- [ ] Keep all existing route paths and response models unchanged.
- [ ] Run backend tests.
- [ ] Commit as `Refactor project API route helpers`.

Stop criteria:

- If any API test changes expected behavior, stop and inspect before continuing.
- If extraction requires changing model schemas, stop; that belongs to a separate contract.

### M6.2 Backend importer split

Target files:

- `app/src/subsidence/data/importers.py`
- Proposed new files:
- `app/src/subsidence/data/importers_common.py`
- `app/src/subsidence/data/import_las.py`
- `app/src/subsidence/data/import_logs_csv.py`
- `app/src/subsidence/data/import_tops.py`
- `app/src/subsidence/data/import_deviation.py`

Steps:

- [ ] Move CSV reading, numeric parsing, well resolution, metadata update, and curve payload writing into common helpers.
- [ ] Extract parser, preview, column validation, and commit helpers as separate seams so a future Import Wizard can reuse the same logic.
- [ ] Move LAS import code without changing public function signature `import_las_file`.
- [ ] Move logs CSV import code without changing public function signature `import_logs_csv`.
- [ ] Move tops/unconformities code without changing public function signatures.
- [ ] Move deviation code without changing public function signature `import_deviation_csv`.
- [ ] Preserve imports from `subsidence.data` so callers do not change.
- [ ] Run backend tests.
- [ ] Commit as `Split data importers by source type`.

Stop criteria:

- If circular imports appear, keep common helpers dependency-free and retry.
- If test fixtures need updating because behavior changed, stop; this refactor should not alter behavior.

### M6.3 Frontend Data Manager controller split

Target files:

- `frontend/src/components/layout/useDataManagerController.ts`
- Proposed new files:
- `frontend/src/components/layout/dataManagerSelection.ts`
- `frontend/src/components/layout/dataManagerVisibility.ts`
- `frontend/src/components/layout/dataManagerActions.ts`
- `frontend/src/components/layout/dataManagerContext.ts`

Steps:

- [ ] Extract pure object-selection helpers first.
- [ ] Extract visibility/toggle helpers for wells, curves, tops, and deviation.
- [ ] Extract context menu action helpers for duplicate/delete/rename.
- [ ] Keep hook public return shape unchanged for `DataManagerPane`.
- [ ] Run frontend tests and build.
- [ ] Commit as `Split Data Manager controller helpers`.

Stop criteria:

- If component tests need rewritten due to changed labels/DOM, stop; UI behavior should not change in M6.3.

### M6.4 Frontend Settings Inspector split

Target files:

- `frontend/src/components/layout/SettingsInspector.tsx`
- Proposed new files:
- `frontend/src/components/layout/settings/WellSettings.tsx`
- `frontend/src/components/layout/settings/LasSettings.tsx`
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/components/layout/settings/TopsSettings.tsx`
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/layout/settings/StratChartSettings.tsx`
- `frontend/src/components/layout/settings/ModelSettings.tsx`

Steps:

- [ ] Extract one settings panel at a time.
- [ ] Keep props explicit and typed.
- [ ] Keep existing labels and controls unchanged.
- [ ] Run frontend tests and build after every 1-2 panels.
- [ ] Commit as `Split Settings Inspector panels`.

Stop criteria:

- If settings behavior is unclear, document the ambiguity in `docs/modules/frontend-layout.md` and stop before changing behavior.

### M6.5 Stylesheet organization

Target files:

- `frontend/src/index.css`

Proposed strategy:

- Prefer section extraction only after component files are stable.
- If Vite import setup is simple, split into:
- `frontend/src/styles/app-layout.css`
- `frontend/src/styles/data-manager.css`
- `frontend/src/styles/log-view.css`
- `frontend/src/styles/subsidence-panel.css`
- `frontend/src/styles/dialogs.css`

Steps:

- [ ] Move CSS by existing selector groups, not by rewriting styles.
- [ ] Keep selector names unchanged.
- [ ] Import style files from `frontend/src/main.tsx` or a single `styles/index.css`.
- [ ] Run frontend tests and build.
- [ ] Manual visual smoke after restart: toolbar, Data Manager, log viewer, subsidence panel, dialogs.
- [ ] Commit as `Organize frontend styles`.

Stop criteria:

- If CSS split changes cascade behavior, revert that slice and leave `index.css` monolithic until visual tests exist.

### M6.6 Documentation update

Target files:

- `docs/codebase-map.md`
- `docs/modules/backend-api.md`
- `docs/modules/backend-data-layer.md`
- `docs/modules/frontend-layout.md`
- `docs/modules/frontend-state.md`
- `docs/modules/testing.md`
- `todo.md`

Steps:

- [ ] Update module ownership after refactor.
- [ ] Update "where to look" guidance.
- [ ] Remove M6 from `todo.md` only after all M6 commits are done and tests pass.
- [ ] Commit as `Update docs after M6 refactor`.

Final M6 acceptance:

- Backend tests pass: `30 passed` or higher.
- Frontend tests pass: `34 passed` or higher.
- Frontend build passes.
- `git status` is clean except intentionally ignored runtime files.
- Public API paths are unchanged.
- Existing project open/save/import workflows still work manually.

---

## Future Work

- [ ] Create and execute `Import Wizard Contract` after M6 refactor.
- [ ] Review and schedule [1D Well Model Architecture](docs/contracts/well_1d_model_architecture.md) and [1D Well Model Summary](docs/contracts/well_1d_model_summary.md).

---

## Future Contract: Import Wizard

Schedule:

- Do this after M6, not inside M6.
- M6 must prepare reusable backend parser/preview/validation seams, but must not implement this feature.

Problem:

- Current CSV/TSV imports go directly from selected file to committed project data.
- User cannot inspect the file, fix header detection, map columns, choose target well, or validate required fields before import.
- This is risky for logs, tops, unconformities, deviation, stratigraphic charts, and future tabular data types where column order and naming vary.

Goal:

- Add a unified import wizard for tabular files.
- User flow: choose file, press load, see preview/mapping dialog, adjust settings, validate, then commit import.

Supported data types:

- Logs CSV/TSV.
- Tops CSV/TSV.
- Unconformities CSV/TSV.
- Deviation CSV/TSV.
- Stratigraphic chart CSV/TSV.
- Future tabular data types should reuse the same preview/mapping framework.

General flow:

- User selects a file from the existing file picker.
- The app does not immediately import it.
- Backend reads a preview, usually first 50 rows.
- Frontend opens an import wizard dialog.
- Dialog shows tabular preview with detected delimiter, detected header row, parsed columns, and sample rows.
- User can adjust delimiter, header row, skipped rows, decimal separator if needed, and column mappings.
- Wizard validates required mappings and highlights status before commit.
- Only after user confirms does the backend perform the real import into the project.

Logs CSV/TSV behavior:

- Preview first 50 rows.
- Auto-detect delimiter: comma, semicolon, tab.
- Auto-detect header row.
- Auto-detect depth column candidates: `DEPT`, `DEPTH`, `MD`, `TVD`, `TVDSS`.
- Auto-detect curve columns and show mnemonic/unit interpretation.
- Target well dropdown must default to active well when one exists.
- User can choose another existing well.
- If data contains no well name, import into selected active/target well.
- If no target well exists or user chooses create-new behavior, use defaults:
- Well name: from file/header if present, otherwise `well-1`.
- X: `0`.
- Y: `0`.
- KB: `10`.
- TD: final depth from imported log data.
- User can confirm or edit target-well metadata before commit.

Tops CSV/TSV behavior:

- Preview first 50 rows.
- Auto-detect delimiter and header row.
- Allow arbitrary column order.
- User maps required columns, at minimum top name and depth.
- Optional mappings: well name, strat age, color, note, unconformity reference, boundary type.
- Required-column checkboxes are shown in the wizard.
- A required checkbox turns green when the column is mapped and valid.
- Target well dropdown defaults to active well.
- If data has no well name, tops import into selected active/target well.
- If no well exists and no target is selected, wizard can create a default well using same defaults as logs.

Unconformities CSV/TSV behavior:

- Same preview and mapping mechanics as tops.
- Required mappings include unconformity name, depth, start age, end age.
- Target well behavior matches tops.
- Wizard must make clear whether imported rows create standalone unconformities or link to existing tops.

Deviation CSV/TSV behavior:

- Preview first 50 rows.
- Auto-detect depth reference: `MD`, `TVD`, or `TVDSS`.
- Auto-detect deviation mode:
- Inclination/Azimuth.
- X/Y.
- dX/dY.
- User can override column mappings.
- Target well dropdown defaults to active well.
- If data has no well name, deviation import into selected active/target well.

Stratigraphic chart CSV/TSV behavior:

- Preview first 50 rows.
- Auto-detect delimiter and header row.
- User maps unit id, parent id, unit name, rank, start age, end age, and color.
- Required-column checkboxes indicate whether the chart can be imported.
- Wizard should show chart name before commit.
- Built-in ICS chart remains protected from deletion and overwrite unless a separate explicit migration contract allows it.

Validation UI:

- Each data type has a required-field checklist.
- Required item states:
- Empty/unmapped: unchecked.
- Mapped but invalid: warning/error.
- Mapped and valid: green checked.
- Preview table highlights mapped columns.
- Preview table should show parse errors by row/column where practical.
- Commit button disabled until required mappings are valid.

Backend API shape:

- Add preview endpoints, for example:
- `POST /api/projects/import-preview/logs-csv`
- `POST /api/projects/import-preview/tops`
- `POST /api/projects/import-preview/unconformities`
- `POST /api/projects/import-preview/deviation`
- `POST /api/strat-charts/import-preview`
- Add commit endpoints that accept mapping/settings payloads.
- Existing direct import endpoints may remain for compatibility but frontend should move to wizard flow.

Backend implementation requirements:

- Preview must not mutate project state.
- Preview must not create wells, curves, tops, deviation, or strat charts.
- Commit must reuse the same parsing/validation logic used by preview.
- Parser should support comma, semicolon, and tab delimiters.
- Parser should support configurable header row and skipped rows.
- Parser should return enough metadata for frontend validation: field names, row count, sample rows, detected delimiter, detected header row, required field status, warnings, and errors.

Frontend implementation requirements:

- Create one reusable import wizard shell.
- Create data-type-specific mapping panels.
- Keep file picker behavior, but route selected files into preview first.
- Dialog should clearly separate:
- File preview.
- Format settings.
- Target well settings.
- Column mapping.
- Validation checklist.
- Commit action.

Testing requirements:

- Backend tests:
- Preview does not mutate project.
- Logs CSV comma/tab preview and commit.
- Tops preview with shuffled column order.
- Deviation preview for each supported mode.
- Strat chart preview and commit.
- Missing required mappings return validation errors.
- Target active well behavior when well name is absent.
- Frontend tests:
- Wizard opens after selecting file instead of direct import.
- Target well defaults to active well.
- Required checkboxes turn valid after mappings.
- Commit disabled until mappings are valid.
- Column mapping changes payload sent to commit endpoint.

Acceptance:

- User can inspect and correct CSV/TSV format before import.
- User can import logs/tops/unconformities/deviation into active or selected well when file has no well name.
- User can map columns with arbitrary order.
- Required mapping state is visible and reliable.
- Existing tests still pass.
- New wizard tests cover preview, validation, and commit flows.
