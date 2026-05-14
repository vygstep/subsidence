# Data Import Workflows

Status: Active
Current branch: `feature/import-multiwell-foundation`

Merged baseline:

- `feature/data-import-workflows` was merged to `main` with Stage 1 and Stage 2 completed.
- Remaining work continues in smaller stage branches from `main`.

## Goal

Make data import workflows consistent and discoverable before adding data export workflows in a separate future branch.

This contract covers import only. Data export is intentionally out of scope and will get its own branch and contract later.

## Current Observations

- Logs, tops, and deviation imports already use the shared import wizard with source selection, preview, parser settings, column mapping where applicable, and target well controls.
- StratChart import is currently a one-step CSV path dialog without preview or column mapping.
- Sea level curves have backend CRUD and point upload endpoints, but no frontend import button or import dialog.
- Marker-to-stratigraphy linking has backend support and an existing `LinkStratChartDialog`, but no visible button in marker settings.
- Lithology SVG pattern import exists from pattern palette settings and is not part of the main data import toolbar.

## Non-Goals

- No data export implementation in this branch.
- No redesign of project open/save.
- No schema changes unless a selected import workflow cannot be implemented safely without one.
- No changes to already working import behavior before user UX review confirms them.

## Stage 1 - UX Review of Existing Imports

Status: Completed.

Result:

- User manually checked the normalized logs, tops, and deviation import UX.
- No additional UX blockers were reported before continuing.

User will manually run the currently working imports and report UX issues before new import work starts:

- `Load logs`
  - LAS import.
  - CSV logs import.
  - Target well behavior.
  - Preview and parser settings.
  - Column mapping.
  - Warning and success messages.
- `Load tops`
  - Existing TopSet selection.
  - New TopSet creation.
  - Target well behavior.
  - Preview and column mapping.
  - Warning and success messages.
- `Load deviation`
  - Target well behavior.
  - Preview and column mapping.
  - Warning and success messages.

Expected output of this stage:

- Confirm which parts of the current import wizard are the reference UX.
- Record any small UX fixes that should happen before StratChart and sea level work.
- Update later stages if the reference UX changes.

Implementation does not begin until this stage is discussed and confirmed.

## Stage 2 - Existing Wizard UX Cleanup

Status: Completed and merged to `main`.

Result:

- Shared import wizard file step now uses bottom primary `Browse...`.
- File selection opens preview directly.
- Inner file-field browse/previous-path controls were removed from logs, tops, and deviation import dialogs.
- Import wizard target-well selection and file field components were centralized.
- Existing import wizard frontend tests were updated and passed before merge.

Normalize and lightly centralize the shared import wizard behavior before adding new data importers.

Expected behavior:

- The first step primary action should open file browsing while no file is selected.
- After a file is selected, the first step primary action should move to preview.
- The final step keeps object-specific submit labels such as `Load logs`, `Load tops`, or `Load deviation`.
- `Use last folder` should be renamed to `Use previous path`.
- Step indicators (`File`, `Preview`) should move closer to the dialog title and no longer visually compete with the form body.
- Import wizard typography and input/select sizing should be aligned with the rest of the application controls.
- Existing logs/tops/deviation import controls should use compact rows:
  - Logs CSV/LAS: target well, depth reference, depth unit in one row where possible.
  - Tops: TopSet policy/name in one row; well/depth reference/depth unit in one row where possible.
  - Deviation: target well and depth unit in one row; extra options below.
- Empty or non-importable files should not crash the app. The UI should show a clear error such as `No importable curves were found in selected file`.

Implementation notes:

- Keep navigation, stepper, error/validation display, and primary action behavior in `ImportWizardShell`.
- Extract the repeated file path selector into a shared import wizard component instead of duplicating Browse/previous path logic across import dialogs.
- Replace the deviation-only checkbox target well UI with the same dropdown pattern used by the other imports.
- Extract or reuse a shared target-well selector so logs, tops, and deviation do not keep separate target well behavior.
- Keep object-specific option rows in their dialogs, but use common compact row CSS.

Likely files:

- `frontend/src/components/layout/importWizard/ImportWizardShell.tsx`
- new shared import wizard field components under `frontend/src/components/layout/importWizard/`
- `frontend/src/components/layout/ImportLasDialog.tsx`
- `frontend/src/components/layout/ImportTopsDialog.tsx`
- `frontend/src/components/layout/ImportDeviationDialog.tsx`
- `frontend/src/styles/dialogs.css`

## Stage 3 - Target Well and Multi-Well CSV Foundation

Unify target well behavior and add multi-well CSV import support.

Expected target well behavior:

- LAS import keeps using LAS header well metadata.
- CSV imports can optionally map a `well_name` field.
- If `well_name` is available and the file contains one well, the UI should auto-select the matching existing well or `Create new well "<file well name>"`.
- If `well_name` is not available, the UI should auto-select the active well, or `Create new well` when no active well exists.
- The user can always override the inferred target by selecting an existing well or `Create new well`.

Expected multi-well behavior:

- A CSV file with multiple `well_name` values may create/update multiple wells in one import.
- When `well_name` is mapped and multiple wells are detected, the import runs in multi-well mode and target-well dropdown selection is not used for row routing.
- If `well_name` is absent or not mapped, imports keep the existing single-well behavior.
- Multi-well import must report how many wells and rows were imported.

Add `Load wells`:

- Add a frontend action for importing well metadata CSV.
- Required/importable fields should include:
  - `well_name`
  - optional `uwi`
  - optional `kb`
  - optional `td`
  - optional `x`
  - optional `y`
  - optional `crs`
- Existing wells are updated by name/identity.
- Missing wells are created using project defaults for absent metadata.

Extend CSV importers:

- Logs CSV:
  - optional mapped `well_name`;
  - grouped by well when multiple well names are present;
  - creates/updates curves per well.
- Tops CSV:
  - optional mapped `well_name`;
  - grouped by well when multiple well names are present;
  - can populate one TopSet for several wells.
- Deviation CSV:
  - optional mapped `well_name`;
  - grouped by well when multiple well names are present;
  - creates one deviation survey per well;
  - each well group must keep strictly increasing depth independently.

Likely files:

- `app/src/subsidence/api/projects_imports.py`
- `app/src/subsidence/data/importers/common.py`
- `app/src/subsidence/data/importers/logs_csv.py`
- `app/src/subsidence/data/importers/tops.py`
- `app/src/subsidence/data/importers/deviation.py`
- new or updated well metadata importer under `app/src/subsidence/data/importers/`
- `frontend/src/components/layout/ProjectToolbar.tsx`
- `frontend/src/components/layout/importWizard/mapping.ts`
- `frontend/src/components/layout/ImportLasDialog.tsx`
- `frontend/src/components/layout/ImportTopsDialog.tsx`
- `frontend/src/components/layout/ImportDeviationDialog.tsx`

## Stage 4 - StratChart Import Wizard

Replace the current one-step `LoadStratChartDialog` flow with the shared import wizard pattern.

Expected behavior:

- Button remains visible in the StratCharts/Data Manager context.
- User selects a CSV file.
- User gets a preview before import.
- User can map required StratChart columns instead of relying on hard-coded column names only.
- Parser settings should match the common tabular import behavior where practical.
- Import should still activate or preserve active chart behavior according to existing backend rules.
- Existing built-in ICS behavior must not regress.

Likely files:

- `frontend/src/components/layout/LoadStratChartDialog.tsx`
- `frontend/src/components/layout/importWizard/*`
- `app/src/subsidence/api/strat_chart.py`
- `app/src/subsidence/api/import_preview.py`

## Stage 5 - Sea Level Curve Import

Add a visible frontend import path for sea level curves.

Expected behavior:

- Add a `Load Sea Level Curve` action in the StratCharts/Data Manager context.
- Use a wizard-style CSV import flow.
- Required mapped fields:
  - age, Ma
  - sea level, m
- User can name the curve.
- Import creates a user-defined curve and uploads/replaces its points.
- Built-in curves remain read-only.
- Imported curve appears in the Sea Level Curves tree and can be assigned in Models settings.

Likely files:

- `frontend/src/components/layout/ProjectToolbar.tsx`
- new or updated sea level import dialog under `frontend/src/components/layout/`
- `frontend/src/components/layout/StratChartTab.tsx`
- `frontend/src/components/layout/settings/SeaLevelCurvesRootSettings.tsx`
- `app/src/subsidence/api/sea_level.py`

## Stage 6 - Link Marker to Stratigraphy

Expose the existing marker-to-stratigraphy link workflow in the UI.

Expected behavior:

- In selected marker settings, show a clear action to link/unlink the marker to a strat chart unit.
- Reuse existing `LinkStratChartDialog` if it fits the workflow.
- The active StratChart should be the default chart scope.
- Existing linked unit display should remain visible.
- Link changes should refresh marker state and preserve undo/redo expectations where backend already supports them.

Likely files:

- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/layout/LinkStratChartDialog.tsx`
- `frontend/src/stores/wellDataStore.ts`
- `app/src/subsidence/api/formations.py`

## Stage 7 - Tests and Documentation

Expected checks:

- Backend tests for changed import endpoints or parser behavior.
- Frontend tests for new import UI where practical.
- Manual smoke test for:
  - logs import
  - tops import
- deviation import
- Load wells import
- multi-well logs/tops/deviation CSV import
- StratChart import
- sea level curve import
- marker stratigraphy linking

Documentation updates:

- Update `todo.md` while the contract is active.
- Move this contract to `docs/contracts/implemented/` only after user confirmation that all stages are complete.

## Acceptance Criteria

- Existing logs/tops/deviation import UX is reviewed and accepted as the baseline or explicitly adjusted.
- Existing import wizard UX is cleaned up before new importer UI is added.
- `Load wells` supports CSV well metadata import.
- CSV logs/tops/deviation can import multiple wells when a mapped `well_name` is present.
- StratChart import uses the common import workflow and supports preview/mapping.
- Sea level curve import is available from the UI.
- Marker settings expose link/unlink to stratigraphy.
- Tests pass or known remaining gaps are documented before merge.
