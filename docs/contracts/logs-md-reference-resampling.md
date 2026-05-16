# Logs MD Reference Resampling

Status: Active
Branch: `feature/logs-md-reference-grid`

## Goal

Normalize imported well logs onto a per-well MD reference grid so exports, display, and downstream calculations use a consistent depth basis.

## Problem

Different LAS/CSV log files for the same well can have different sampling steps and small depth offsets. Current storage preserves native samples by unioning all depth values in `curves/{well.id}.parquet`, which can create sparse internal data and inconsistent exports.

The well's canonical depth axis must be MD. TVD and TVDSS are derived views computed from deviation data, not separate log storage axes.

## Required Behavior

### Canonical Well Log Grid

- Add one canonical MD grid per well.
- Default grid step: `0.2 m`.
- Grid range is `0..TD`.
- If imported log data extends below the current TD, update TD first and build the grid to the updated TD.
- If TD changes later, new imports use the current TD. Automatic rebuild of existing curves after manual TD edits is out of scope for the first implementation.

### Import Null Values

- LAS import:
  - auto-detect `NULL` from the LAS header;
  - if missing, default to `-999.25`;
  - allow the user to override the import null value in the LAS import dialog.
- CSV logs import:
  - default null value is `-999.25`;
  - allow the user to set the import null value in the CSV logs import dialog.
- Empty CSV cells and values equal to the selected import null value are gaps.
- Explicit null/gap intervals must be preserved during resampling and storage.

### MD Logs

- Logs imported with `trusted_depth_reference=MD` are resampled directly onto the canonical MD grid.
- Continuous curves use linear interpolation.
- Discrete curves use step-down/block behavior: the current value applies downward until the next native sample.
- Null gaps are not bridged.
- Values outside the native curve range remain null.

### TVD / TVDSS Logs

- Logs imported with `trusted_depth_reference=TVD` or `TVDSS` are converted to MD before resampling.
- If a deviation survey exists:
  - `TVD` is converted to MD using the well deviation survey;
  - `TVDSS` is converted to TVD using `TVD = TVDSS + KB`, then converted to MD.
- If no deviation survey exists:
  - treat the well as vertical for this import;
  - `TVD -> MD = TVD`;
  - `TVDSS -> MD = TVDSS + KB`;
  - emit a warning that the log was placed on MD using a vertical-well assumption and may need reimport after deviation is loaded.
- Do not automatically reposition previously imported TVD/TVDSS logs when deviation is loaded later.

### Deviation Safety

- Deviation import keeps the existing behavior:
  - recalculates picks `depth_tvd` and `depth_tvdss`;
  - warns when deviation ends above imported data and extrapolation uses the last inclination/azimuth.
- Log storage remains MD-only and is not rewritten when deviation changes.
- `/wells/{well_id}/curves/full?depth_basis=TVD|TVDSS` continues to derive curve display depths from MD via deviation.

### Exports

- CSV and LAS log exports should read the canonical regular MD grid.
- LAS export dialog null value behavior from `las-export-resampling.md` remains valid.
- LAS export resampling can remain as a defensive safety layer, but new imports should already be regular.

## Implementation Stages

1. Add schema support for per-well log grid settings.
   - `wells.log_md_grid_step_m`, default `0.2`.
   - Lightweight schema migration is enough; no data migration is required because no legacy production projects need automatic conversion.
2. Add a shared import-time resampling helper.
   - Build `0..TD` MD grids.
   - Preserve null gaps.
   - Cover continuous, discrete, outside-range nulls, TVD/TVDSS conversion, and vertical fallback with unit tests.
3. Integrate LAS import.
   - Add import null value override to the dialog/API.
   - Read LAS header `NULL` as the suggested default.
   - Store resampled curves on the canonical MD grid.
4. Integrate CSV logs import.
   - Add import null value to the dialog/API.
   - Treat empty cells and selected null values as gaps.
   - Store resampled curves on the canonical MD grid.
5. Verify deviation and display behavior.
   - Loading deviation after logs must not rewrite log storage.
   - TVD/TVDSS display must still update through existing derived-depth APIs.
   - Picks and zones must retain the current recalculation behavior.
6. Update exports/tests as needed.
   - Confirm CSV/LAS exports are regular after import.
   - Keep LAS export dialog settings and defensive export resampling.

## Areas To Analyze

- Whether per-well grid step editing should be exposed in UI now or later.
- How to handle existing non-production projects and already imported curves.
- How this affects `CurveMetadata.depth_min`, `depth_max`, `n_samples`, `sampling_kind`, and `nominal_step_m`.
- How much raw native sample data should be retained for audit or future reimport.
- Whether discrete/lithology curves need special label/code-map handling.

## Non-Goals For First Pass

- No full raw-native sample archive unless explicitly added in a later contract.
- No automatic repositioning of old TVD/TVDSS log imports after deviation is loaded.
- No automatic rebuild of existing curves after manual TD edits.
- No discrete visualization rewrite unless needed to support storage correctness.
