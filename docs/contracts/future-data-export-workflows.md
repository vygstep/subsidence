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
- `projects.py` already exposes cross-platform `pick-folder` through the backend. It normalizes the initial directory and uses `mustexist=True`.
- Existing notification UI is QC-warning oriented. If success toasts are needed, add a small general notification path instead of overloading QC warnings.

## UX Direction

- Prefer export actions from Data Manager object context menus and object settings.
- Start with single-object export before batch export.
- Keep export labels explicit, for example `Export tops CSV`, `Export curve CSV`, `Export sea level curve CSV`.
- Show success/error messages in the existing notification area.
- Export workflows should support both:
  - writing to a user-selected folder;
  - browser download fallback when no folder is selected.
- Folder selection should reuse the existing backend `pick-folder` mechanism so Windows and macOS behavior matches import/project dialogs.
- Remember export folders separately from import folders.
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

## Export Location

Every export dialog/action that writes files should have a consistent location model:

- `Export folder`: optional path selected through `pickFolder(...)`.
- `Use browser download`: fallback when export folder is empty.
- `Remember export folder`: store the last selected export folder separately, for example `subsidence:last-export-root`.
- `Reveal in Explorer/Finder`: available after folder-based export using the existing `revealInExplorer(...)` helper.

Backend endpoint behavior:

- If `output_dir` is provided:
  - validate that it exists and is a directory;
  - write the generated file(s) into that directory;
  - return JSON with written file paths and counts.
- If `output_dir` is omitted:
  - return a file/ZIP response for browser download.
- Do not create arbitrary nested directories in the first pass.
- Do not use native blocking save dialogs in export routes.

Batch behavior:

- If `Export to ZIP` is enabled, write/return one ZIP.
- If `Export to ZIP` is disabled and `output_dir` is set, write multiple files into the selected folder.
- If `Export to ZIP` is disabled and `output_dir` is empty, frontend may trigger multiple browser downloads sequentially, but should warn when this may be blocked by browser settings.

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

## Round-Trip Compatibility

Every first-pass export must be compatible with automatic import back into SUBSIDENCE.

The user should be able to export data, import it into a clean project, and get the same objects without manually remapping columns or repairing metadata.

Requirements:

- Exported CSV/LAS files must use canonical names that the current import wizards can auto-map.
- Table column order and names should follow existing importer expectations where possible.
- Extra project-only fields are allowed only if they do not break existing importers.
- LAS export must write well and curve metadata so the current LAS importer recreates the intended well and curve set from the exported file.
- Tops export must preserve enough TopSet/horizon/pick attributes to restore names, ages, depths, paleobathymetry, sea-level override, erosion, and hiatus where the current importer supports those fields.
- Deviation export must preserve native mode fields so the current deviation importer detects the same mode automatically.
- Strat chart and sea level exports must use columns that the current loaders can auto-map.

Before implementing each export stage:

- Compare the proposed export schema with `frontend/src/components/layout/importWizard/mapping.ts`.
- Compare it with the backend importer request and parser for that object type.
- If the importer cannot automatically restore an exported field that is required for project fidelity, extend the importer first or record the gap explicitly before exporting that field.
- Do not ship a "pretty export" that cannot be imported back without manual setup.

## Stage 1 - Export Infrastructure

Status: Implemented

- Add a backend export router under `/api/export`.
- Add a small CSV response helper with stable filename handling.
- Add a ZIP response helper for optional batch exports.
- Add shared filename sanitization.
- Add shared output directory validation and file write result payloads.
- Register the router in `api/main.py`.
- Add a frontend download helper that saves CSV/LAS/ZIP responses via `Blob`.
- Extend `pathMemory.ts` with export-folder helpers.
- Add a small shared export location UI/helper instead of duplicating folder controls per exporter.
- Add batch download helper behavior:
  - if ZIP is enabled, one response downloads one archive;
  - if ZIP is disabled, frontend may trigger multiple per-well downloads sequentially;
  - if browser restrictions make multiple downloads unreliable, prefer ZIP and show a clear message.
- Use existing notification area for success/error where practical.
- Add focused tests for CSV response formatting if backend test patterns make this cheap.

## Stage 2 - Well Info Export

Status: Implemented

- Add export endpoint for well info.
- Add current-well and all-wells modes.
- In WELLS toolbar, group existing import buttons under `Load`.
- Add adjacent `Export` menu.
- Initial Export menu entries:
  - `Export current well info`
  - `Export all wells info`
- Export one well info row per per-well output file:
  - `well_name`
  - `uwi`
  - `td_md`
  - `kb_elev`
  - `gl_elev`
  - `x`
  - `y`
  - `coordinate_semantics`
  - `crs`
  - `depth_unit`
  - `color_hex`
- Include `source_las_path` and selected `well.extra` values where available without breaking round-trip import.
- Do not export internal project `well_id`.
- Omit optional columns that are empty for every exported row.
- Support table packaging:
  - one file by well;
  - one file for all wells;
  - ZIP only for one file by well.
- Support export folder and browser download.
- Verify with a project containing multiple wells.

## Stage 3 - Logs And Curves Export

Status: Implemented

- Add current-well logs CSV export.
- Add all-wells logs CSV export as one file per well only, with optional ZIP.
- Add current-well logs LAS export.
- Add all-wells logs LAS export as one file per well only, with optional ZIP.
- Do not offer `one file for all wells` for logs/curves in this stage. Different wells can have different depth grids and curve sets; per-well files preserve round-trip compatibility.
- Read dense samples from project Parquet through existing loader helpers.
- CSV output should contain one file per well with:
  - `well_name` for automatic target-well creation/matching;
  - `DEPT [m]` as the depth column;
  - one project curve per column;
  - column labels including current project mnemonic and unit, for example `GR [api]`.
- CSV output must use current project `CurveMetadata.mnemonic` and `CurveMetadata.unit`, not original source headers.
- LAS output must be rebuilt from current project state:
  - well metadata from `WellModel`;
  - curve metadata from `CurveMetadata`;
  - curve samples from project Parquet;
  - no copying original LAS payloads from `source_las_path`.
- LAS well section should include project-edited well name, UWI, KB/EREF, TD, X/Y stored as SLON/SLAT with project coordinate semantics documented, CRS/HZCS, and project null value.
- LAS curve section should use current project curve mnemonics and units.
- Add UI actions from WELLS toolbar `Export` menu:
  - `Export current well logs CSV`;
  - `Export all wells logs CSV`;
  - `Export current well logs LAS`;
  - `Export all wells logs LAS`.
- Reuse the existing export location/dialog style from well info export.
- Verify continuous curves first; discrete curves should be exported if present but may need a later contract for label dictionaries.

## Stage 4 - Tops, TopSets, Picks, And Zones Export

Status: Implemented

- Add export for per-well picks/tops as the main round-trip format for TopSet data.
- Do not add a separate zones export in this stage. Zones are derived from TopSet horizons plus per-well picks and are rebuilt after tops import.
- Include TopSet, horizon, pick, and zone-related attributes in the tops export so one tops file can restore the stratigraphic well state where possible.
- Export stable names instead of internal IDs:
  - `well_name`
  - `topset_name`
  - `top_name`
  - horizon/pick names and readable attributes.
- Export importer-compatible tops columns:
  - `depth_md`
  - `age_ma`
  - `boundary_type`
  - `hiatus_duration_ma`
  - `eroded_thickness_m`
  - `water_depth_m`
  - `sea_level_m_override`
  - `lithology`
  - `lithology_fractions`
  - `lithology_source`
  - `color`
  - `note`
- Export calculated fields only as informational QA columns, not as import source of truth:
  - `depth_tvd`
  - `depth_tvdss`
  - `zone_thickness_md`
  - `zone_thickness_tvd`
  - `lower_top_name`
- Extend tops import before shipping this stage when needed so exported files can be automatically imported back without manual column mapping or metadata repair.
- Tops import should use `topset_name` from the file when present, and should restore project-relevant attributes such as paleobathymetry, sea-level override, erosion, hiatus, lithology, and lithology fractions.
- Keep calculated fields recalculated after import:
  - TVD/TVDSS from deviation and well metadata;
  - zone rows from TopSet horizon order;
  - zone thickness from pick depths and zone service logic.
- Add UI actions from the WELLS toolbar `Export` menu:
  - `Export current well tops CSV`
  - `Export all wells tops CSV`
- Support table packaging:
  - one file by well;
  - one file for all wells;
  - ZIP only for one file by well.
- Verify multi-well TopSet behavior:
  - exporting/importing picks from multiple wells into the same `topset_name` does not duplicate horizons incorrectly;
  - zones are rebuilt per well after import;
  - existing automatic zone creation remains the source of truth.

## Stage 5 - Deviation Export

Status: In Progress

- Add current-well deviation CSV export.
- Add all-wells deviation CSV export.
- Read the stored deviation Parquet payload.
- Preserve native imported mode and columns:
  - depth column remains `md`, `tvd`, or `tvdss`;
  - mode columns remain `incl_deg`/`azim_deg`, `x`/`y`, or `dx`/`dy`.
- Add `well_name` to exported CSV so the existing multi-well deviation importer can recreate or match wells automatically.
- Support table packaging:
  - one file by well;
  - one file for all wells;
  - ZIP only for one file by well.
- Add UI actions from the WELLS toolbar `Export` menu:
  - `Export current well deviation CSV`;
  - `Export all wells deviation CSV`.
- Verify round-trip with INCL/AZIM. Verify X/Y or DX/DY if sample data exists.

## Stage 6 - Strat Chart And Sea Level Curve Export

Status: In Progress

- Add stratigraphic chart CSV export.
- Add sea level curve CSV export.
- StratChart export uses one CSV per chart for round-trip compatibility. Do not combine multiple charts into one CSV because the current importer creates one chart from one file.
- StratChart export columns:
  - `unit_id`
  - `parent_unit_id`
  - `unit_name`
  - `rank_name`
  - `start_age_ma`
  - `end_age_ma`
  - `color`
- Add UI actions from the StratCharts toolbar:
  - `Export active StratChart`
  - `Export all StratCharts`
- `Export all StratCharts` supports one file per chart, optional ZIP, and export folder/browser download.
- Verify imported and built-in chart behavior.

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
