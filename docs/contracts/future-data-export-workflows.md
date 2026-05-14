# Future Data Export Workflows

Status: Future

## Goal

Add consistent export workflows for project data after the import workflows are stable.

This contract is a placeholder. Before implementation, read the current code, split the work into smaller stages, and confirm each stage with the user.

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

## Initial UX Direction

- Prefer export actions from Data Manager object context menus and object settings.
- Start with single-object export before batch export.
- Keep export labels explicit, for example `Export tops CSV`, `Export curve CSV`, `Export sea level curve CSV`.
- Show success/error messages in the existing notification area.
- Use remembered export folders if a shared path-memory mechanism exists.

## Initial Format Direction

- CSV for tabular data first.
- Dense curve data can start as CSV if practical; Parquet export can be added later for large data.
- JSON can be considered for full object snapshots only after CSV workflows are clear.
- PNG/chart image export is separate and should not block data export.

## Notes for Later Analysis

- Check whether export should read from SQLite, Parquet payloads, or existing API response builders.
- Check whether exported data should preserve internal IDs or use stable names plus optional IDs.
- Check unit handling before exporting logs, depths, and calculated results.
- Check how to export active per-well selections such as active TopSet and active sea level curve.
- Decide whether project-level export should be a separate archive workflow.

## Non-Goals

- No implementation in the current import branch.
- No project archive/package export in the first pass unless explicitly confirmed.
- No automatic cloud or remote export.
