# LAS Export Resampling

Status: Active
Branch: `bug/las-export-resampling`

## Goal

Export LAS files on a regular per-well MD grid without changing the current log import/storage pipeline.

## Problem

Well log storage currently preserves native curve depth samples and export builds a union of all curve depths. If multiple LAS/CSV files were imported into the same well with different sampling steps or small MD offsets, the exported LAS can become sparse: many rows contain a value for one curve and nulls for the rest.

## Scope

- Apply resampling only during LAS export.
- Do not change CSV log export in this contract.
- Do not change log import or stored Parquet payloads.
- Do not implement the long-term per-well MD reference grid from `logs-md-reference-resampling.md`.

## Required Behavior

- Add LAS export settings to the well logs export dialog:
  - `Step (m)`, default `0.2`.
  - `Null value`, default `-999.25`.
- Validate export settings before export:
  - `Step (m)` must be a positive finite number.
  - `Null value` must be a finite number.
- For each exported well, build its own regular MD grid from the minimum to maximum depth present in that well's exported curve data.
- Continuous curves:
  - resample with linear interpolation on the export grid;
  - keep null/missing gaps as gaps;
  - do not interpolate outside the curve native depth range.
- Discrete curves:
  - resample as step-down/block curves;
  - the current value applies downward until the next native sample;
  - null/missing gaps stay null and are not bridged by the previous value.
- Write the selected null value into LAS `~Well` `NULL`.
- Write the selected null value into all missing samples in the exported LAS data section.
- Keep one LAS file per well. For all-well export, each well gets an independent MD grid.

## Current Code Notes

- Backend LAS export is in `app/src/subsidence/api/export.py`.
- `_curve_frame(...)` currently creates the sparse union-depth frame used by both CSV and LAS export.
- `_logs_las_bytes(...)` currently replaces `NaN` with the first curve metadata `null_value` or `-999.25`.
- LAS import already reads LAS header `NULL` into curve metadata when available.
- The frontend well log export dialog is `frontend/src/components/layout/ExportWellLogsDialog.tsx`.

## Acceptance Criteria

- Exporting LAS from a well with curves sampled at different MD steps produces one regular MD grid using the dialog step.
- LAS export no longer contains duplicate offset rows solely because different curves had slightly different native sample positions.
- Continuous curves interpolate only through valid sample intervals.
- Discrete curves are exported as block/step values, with null gaps preserved.
- The LAS header `NULL` value matches the dialog value.
- Current CSV log export behavior remains unchanged.
- Existing export packaging behavior remains unchanged:
  - current well downloads/writes one LAS;
  - all wells writes one LAS per well or ZIP when selected.

## Follow-Up / Out Of Scope

- Project-level default LAS null value setting.
- LAS import dialog override for null value when a user wants to ignore or replace the LAS header value.
- Proper per-well MD reference grid in storage from `0..TD`.
- Discrete curve visualization as block/step rendering with null gaps.
