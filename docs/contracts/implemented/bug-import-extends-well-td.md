# BUG: Import Extends Well TD and Deviation Extrapolation

## Status

`implemented`

## Problem

When logs, tops, or deviation data are imported deeper than the current well TD, the backend may update TD silently. The user does not get a QC warning that imported data extended the well. Also, TVD/TVDSS conversion below the last deviation survey station currently clamps to the last TVD instead of extending the well path with the last inclination/azimuth.

## Desired Behavior

### Import TD extension

If imported logs, tops, or deviation survey data extend deeper than current `well.td_md`:

- Import should succeed.
- `well.td_md` should be updated to the deepest imported MD.
- A QC warning should be returned:
  `Imported data extends below current TD 6000.0 m; TD was updated to 8000.0 m.`
- The warning should appear in the existing QC warning panel.

Applies to:

- LAS import
- Logs CSV import
- Tops import
- Deviation import

### Manual edit contrast

Manual single-top edits deeper than TD should still be rejected and not auto-expand TD. Auto-extension is import-only behavior.

### Deviation extrapolation

If TVD/TVDSS is requested for MD deeper than the last INCL/AZIM survey station:

- Continue from the last survey point using the last inclination and azimuth.
- Do not clamp TVD to the last survey TVD.
- Return a QC warning when imported curve/top data require this extrapolation:
  `Deviation survey ends at 6200.0 m; TVD/TVDSS below this depth uses the last inclination/azimuth.`
- Backend and frontend depth conversion should use the same extrapolation behavior.

## Implementation Plan

### Step 1: Track TD extension warnings

Files:

- `app/src/subsidence/data/importers/common.py`
- `app/src/subsidence/data/importers/las.py`
- `app/src/subsidence/data/importers/logs_csv.py`
- `app/src/subsidence/data/importers/tops.py`
- `app/src/subsidence/data/importers/deviation.py`
- `app/src/subsidence/api/projects_imports.py`

Add helper that compares old TD vs imported deepest MD before updating TD and returns a QC warning if TD was expanded.

### Step 2: Deviation extrapolation backend

Files:

- `app/src/subsidence/data/deviation_transform.py`
- `app/src/subsidence/api/wells.py`

Change MD-to-TVD conversion beyond last survey station to extend using the last inclination/azimuth.

### Step 3: Deviation extrapolation frontend

File:

- `frontend/src/utils/depthTransform.ts`

Mirror backend extrapolation for `mdToTvd`.

### Step 4: Verification

Automated checks:

- `pytest tests/integration/test_project_api_workflows.py -k "tops_import_create_top_set_preserves_td_extension_warning or tops_import_warns_and_extrapolates_below_deviation_survey or logs_import_extends_well_td_with_warning or deviation_import_extends_well_td_with_warning"`: 4 passed.
- `npm run test -- --run ImportDialogTargetWell.integration.test.tsx`: 7 passed.
- `npm run test -- --run depthTransform.test.ts`: 1 passed.

Manual checks:

- Import logs deeper than current TD updates TD and shows QC warning.
- Import tops deeper than current TD updates TD and shows QC warning.
- Import deviation deeper than current TD updates TD and shows QC warning.
- Top manual edit deeper than TD is still rejected.
- TVD/TVDSS below last survey point increases according to last INCL/AZIM instead of clamping.
