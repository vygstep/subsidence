# Data Import Workflows

Status: Active
Branch: `feature/data-import-workflows`

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

## Stage 2 - StratChart Import Wizard

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

## Stage 3 - Sea Level Curve Import

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

## Stage 4 - Link Marker to Stratigraphy

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

## Stage 5 - Tests and Documentation

Expected checks:

- Backend tests for changed import endpoints or parser behavior.
- Frontend tests for new import UI where practical.
- Manual smoke test for:
  - logs import
  - tops import
  - deviation import
  - StratChart import
  - sea level curve import
  - marker stratigraphy linking

Documentation updates:

- Update `todo.md` while the contract is active.
- Move this contract to `docs/contracts/implemented/` only after user confirmation that all stages are complete.

## Acceptance Criteria

- Existing logs/tops/deviation import UX is reviewed and accepted as the baseline or explicitly adjusted.
- StratChart import uses the common import workflow and supports preview/mapping.
- Sea level curve import is available from the UI.
- Marker settings expose link/unlink to stratigraphy.
- Tests pass or known remaining gaps are documented before merge.
