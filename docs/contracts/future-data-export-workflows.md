# Data Export Workflows

Status: Active
Branch: `feature/data-export-workflows`

## Goal

Add consistent CSV export workflows for project data.

Implementation must be staged and manually verified after each step. The first pass should prefer browser downloads from HTTP responses instead of backend-native save dialogs.

## Scope

Export should be available for the main project objects:

- Wells metadata.
- Logs and curve data.
- Tops, TopSets, horizons, and per-well picks.
- Deviation surveys.
- Stratigraphic charts and units.
- Sea level curves.
- Lithology dictionaries, lithology sets, and pattern palette metadata.
- Compaction presets and compaction models.
- Subsidence/backstripping results.

## Current Findings

- No backend export router is currently registered.
- Existing data access endpoints already expose most data in JSON form.
- Dense log and deviation payloads are stored in Parquet and can be read through existing loader helpers.
- LAS import currently uses `lasio`, but there is no LAS writer/export builder yet.
- Frontend currently has PNG chart export only.
- Data Manager already has object context menus, so export actions can be added there incrementally.
- Data Manager context-menu wiring lives primarily in `DataManagerPane.tsx` and `WellDataPanel.tsx`.
- `pathMemory.ts` remembers import/project paths, but first-pass export can rely on browser download behavior.
- Existing notification UI is QC-warning oriented. If success toasts are needed, add a small general notification path instead of overloading QC warnings.

## UX Direction

- Prefer export actions from Data Manager object context menus and object settings.
- Start with single-object export before batch export.
- Keep export labels explicit, for example `Export tops CSV`, `Export curve CSV`, `Export sea level curve CSV`.
- Show success/error messages in the existing notification area.
- Use browser downloads first. Explicit export-folder workflows are deferred unless the user asks for them.
- For well-scoped data, expose both:
  - `Export current well ...`
  - `Export all wells ...`
- Table `Export all wells ...` supports two packaging modes:
  - one file per well;
  - one combined file for all wells.
- Table `Export to ZIP` is available only when `one file per well` is selected.
- LAS `Export all wells ...` supports only one file per well.
- LAS `Export to ZIP` is available for batch LAS export.

## Format Direction

- CSV for tabular data first.
- Dense curve data can start as CSV if practical; Parquet export can be added later for large data.
- JSON can be considered for full object snapshots only after CSV workflows are clear.
- PNG/chart image export is separate and should not block data export.
- LAS export is required for log data. LAS files must be rebuilt from current project metadata and curve payloads, not copied from original source LAS files.

## Export Scope Matrix

The first implementation should support well-scoped export in two dimensions:

### Scope

- `Current well`: export only the active/selected well.
- `All wells`: export every well that has the selected object type.

### Packaging

- Table exports:
  - `One file by well`;
  - `One file for all wells`;
  - `Export to ZIP` only when `One file by well` is selected.
- LAS exports:
  - `One file by well` only;
  - `Export to ZIP` optional for batch LAS export;
  - `One file for all wells` hidden/not available.

Examples:

- `Export current well heads CSV` -> `well-1_well_head.csv`
- `Export all well heads CSV` with `One file for all wells` -> `well_heads.csv`
- `Export all well heads CSV` with `One file by well` -> multiple `*_well_head.csv` files, or `well_heads.zip` if `Export to ZIP` is checked.
- `Export current well LAS` -> `well-1_logs.las`
- `Export all wells LAS` -> multiple `*_logs.las` files, or `logs_las.zip` if `Export to ZIP` is checked.

## Source Of Truth

Exports must use current project state, not original imported source files.

Primary data sources:

- Well heads: `WellModel`.
- Logs: `CurveMetadata` plus project Parquet through `load_curves_from_parquet(...)`.
- Deviation: `DeviationSurveyModel` plus project Parquet through `load_deviation_from_parquet(...)` or direct DataFrame read when native columns must be preserved.
- Picks/tops: `FormationTopModel`, `TopSetHorizon`, `TopSet`, `FormationStratLink`.
- Zones: `FormationZone` plus `ZoneWellData`.
- Stratigraphy: `StratChart` and `StratUnit`.
- Sea level: `SeaLevelCurve` and `SeaLevelPoint`.
- Results: `CalculationResult` plus result payload files.

For LAS/log export:

- Well metadata comes from `WellModel`.
- Curve metadata comes from `CurveMetadata`.
- Curve samples come from project Parquet payloads.
- Units, null values, curve type, canonical mnemonic, and edited metadata come from the current project database.
- `source_las_path` is informational only and must not be copied as the export payload.
- Add a dedicated LAS builder. It may use `lasio` for writing, but must construct the file from project data.
- Exported LAS should include project-edited well metadata where LAS sections support it.
- If a project field has no clear LAS header target, document the omission or place it in a controlled comments/other section.

For tops/markers export:

- Export current pick and horizon state from the project database.
- Include per-well pick attributes and TopSet/horizon metadata.
- Include model-relevant attributes where available:
  - `depth_md`
  - `depth_tvd`
  - `depth_tvdss`
  - `age_top_ma`
  - `age_base_ma`
  - `water_depth_m`
  - `sea_level_m_override`
  - `eroded_thickness_m`
  - `hiatus_duration_ma`
  - `kind`
  - `lithology`
  - `color`
  - active strat chart link fields where available.

## Stage 1 - Export Infrastructure

Status: Planned

- Add a backend export router under `/api/export`.
- Add a small CSV response helper with stable filename handling.
- Add a ZIP response helper for optional batch exports.
- Add shared filename sanitization.
- Register the router in `api/main.py`.
- Add a frontend download helper that saves CSV/LAS/ZIP responses via `Blob`.
- Add batch download helper behavior:
  - if ZIP is enabled, one response downloads one archive;
  - if ZIP is disabled, frontend may trigger multiple per-well downloads sequentially;
  - if browser restrictions make multiple downloads unreliable, prefer ZIP and show a clear message.
- Use existing notification area for success/error where practical.
- Add focused tests for CSV response formatting if backend test patterns make this cheap.

## Stage 2 - Wells Metadata Export

Status: Planned

- Add `GET /api/export/wells.csv`.
- Add current-well and all-wells modes.
- Export one well head row per output file:
  - `well_id`
  - `well_name`
  - `td_md`
  - `kb_elev`
  - `gl_elev`
  - `x`
  - `y`
  - `coordinate_semantics`
  - `crs`
  - `color_hex`
- Add UI action from the wells/root context or settings area.
- Verify with a project containing multiple wells.

## Stage 3 - Logs And Curves Export

Status: Planned

- Add single-curve CSV export for one well and mnemonic.
- Add all-curves CSV export for one well.
- Add LAS export for current well logs.
- Add LAS export for all wells logs as per-well files, with optional ZIP.
- Read dense samples from Parquet through existing loader helpers.
- For CSV all-curves export, decide before implementation whether one file contains all curves in columns or one file per curve. Record the decision before coding.
- Preserve depth column and curve units in header or metadata-friendly column names.
- LAS metadata must reflect current project metadata, not original imported LAS headers.
- Add UI actions from curve and LAS/logs group context menus.
- Verify continuous and discrete curves.

## Stage 4 - Tops, TopSets, Picks, And Zones Export

Status: Planned

- Add export for per-well picks/tops.
- Add export for a TopSet horizon list.
- Add export for per-well active TopSet zones and `ZoneWellData`.
- Include IDs where useful, but keep stable names readable.
- Add UI actions from TopSet, marker, tops group, and zone contexts only where the object is clear.
- Verify multi-well TopSet behavior.

## Stage 5 - Deviation Export

Status: Planned

- Add per-well deviation CSV export.
- Read the stored deviation Parquet payload.
- Preserve native imported mode and columns where possible.
- Add UI action from deviation group context menu.
- Verify INCL/AZIM and non-INCL/AZIM modes if sample data exists.

## Stage 6 - Strat Chart And Sea Level Curve Export

Status: Planned

- Add stratigraphic chart CSV export.
- Add sea level curve CSV export.
- Add UI actions from strat chart and sea level curve settings/context where available.
- Verify imported and built-in chart/curve behavior.

## Stage 7 - Later Export Areas

Status: Planned

These should be analyzed after the core CSV workflows are stable:

- Lithology dictionaries.
- Lithology sets.
- Lithology pattern palette metadata.
- Compaction presets and compaction models.
- Subsidence/backstripping results.
- Project-level archive/package export.

## Open Decisions

- Check whether export should read from SQLite, Parquet payloads, or existing API response builders.
- Check whether exported data should preserve internal IDs or use stable names plus optional IDs.
- Check unit handling before exporting logs, depths, and calculated results.
- Check how to export active per-well selections such as active TopSet and active sea level curve.
- Decide whether project-level export should be a separate archive workflow.

## Non-Goals

- No project archive/package export in the first pass unless explicitly confirmed.
- No automatic cloud or remote export.
- No native blocking save dialogs in async backend routes.
- No Parquet export in the first pass unless CSV becomes impractical for dense logs.
