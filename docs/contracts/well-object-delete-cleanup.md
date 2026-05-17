# Well Object Delete Cleanup

Status: Draft
Branch: TBD

## Goal

Make delete operations remove owned data and object-specific settings cleanly so deleted wells, curves, deviation surveys, and picks do not leave dangling database rows, stale UI settings, or orphan project files.

## Problem

Some objects are deleted from metadata, but related files or settings can remain:

- deleting a single curve removes `CurveMetadata`, but the curve column can remain inside the well parquet file;
- full well deletion needs an explicit cleanup path for logs, deviation, picks, active settings, calculation results, and well-scoped visual config;
- object-specific settings should not keep references to deleted wells or curves.
- curve visual settings are intentionally persistent per curve, but current track placement can behave like a persistent binding; disabling a curve and enabling it after selecting another track can re-use the old track instead of placing the curve into the currently active track.

## Required Behavior

### Delete Well

When a well is deleted, remove all data that belongs only to that well:

- curve metadata and curve parquet files that are no longer referenced;
- deviation survey metadata and deviation parquet file;
- formation tops and strat links;
- zone well data rows for this well;
- active TopSet setting for this well;
- active sea-level curve setting for this well;
- calculation results for this well and their files;
- well-scoped visual config rows and curve/model settings that reference this well.

Shared objects must not be deleted:

- TopSets and horizons;
- strat charts and units;
- sea-level curves;
- lithology sets;
- compaction dictionaries/presets/models.

### Delete Single Curve

When one curve is deleted from a well:

- delete the matching `CurveMetadata`;
- if the parquet file contains other curves, remove only the deleted curve column and keep the other curves;
- if no curves remain in that parquet file, delete the parquet file;
- remove or reset well-scoped settings that reference the deleted curve.

### Curve Visibility And Track Placement

Curve visual settings and curve track placement must be treated as different concepts:

- persistent per-curve visual settings are good and should remain:
  - color;
  - line width;
  - line style;
  - scale min/max;
  - reversed scale;
  - other curve rendering settings stored by mnemonic.
- track placement is not a persistent curve property:
  - a curve should not be permanently bound to the track where it was first visualized;
  - disabling a curve should remove it from the current track layout but keep its visual settings;
  - enabling a curve should add it to the currently selected track when a valid curve track is selected;
  - if no valid curve track is selected, enabling a curve may create/use the default/new curve track;
  - enabling a curve must not silently restore it into an old track just because a previous layout stored it there.

When a curve is deleted as a data object:

- remove it from all tracks;
- remove it from `hiddenCurveMnemonics`;
- remove its `curveSettingsByMnemonic[mnemonic]` entry, because the underlying curve object no longer exists.

When all curves are deleted for a well:

- clear all track curve entries;
- clear all curve visual settings for that well;
- clear hidden curve state for that well.

When a well is deleted:

- remove the entire well-scoped visual config/state, including tracks, hidden curves, curve settings, and track widths that belong only to that well.

### Delete All Curves

When all curves are deleted from a well:

- delete all curve metadata for that well;
- delete curve parquet files that are no longer referenced;
- reset well-scoped curve settings for that well.

### Delete Deviation

Keep current behavior:

- delete deviation metadata and parquet;
- reset/recalculate pick TVD/TVDSS using vertical fallback.

Review whether additional well-scoped settings must be cleared.

### Delete Formation Pick

Keep current behavior:

- delete the pick;
- recalculate zone thickness and lithology for the active TopSet/well.

Review whether pick-specific UI state must be cleared.

## Implementation Stages

1. Inventory current delete paths.
   - Find all backend delete endpoints and frontend calls.
   - List project files created per object type.
   - Identify settings rows/JSON keys that can reference wells or curves.
2. Add cleanup helpers.
   - File-safe helper for deleting unreferenced project files.
   - Parquet helper for dropping one curve column while preserving remaining curves.
   - Settings cleanup helper for well/curve references.
3. Implement delete well endpoint/workflow.
   - Prefer command/undo path if existing project workflow supports it.
   - Ensure owned DB rows and owned files are removed.
4. Harden curve delete workflows.
   - Single-curve delete drops only the column.
   - Delete-all-curves removes all curve data and settings.
5. Fix curve visibility/track placement semantics.
   - Keep `curveSettingsByMnemonic` as the persistent style store.
   - Remove disabled curves from track layout.
   - Re-enable curves into the active selected track, not the old track.
   - Delete curve settings only when the data object is actually deleted.
6. Add regression tests.
   - Delete well removes owned rows and files.
   - Delete single curve preserves sibling curves but removes the parquet column.
   - Delete all curves removes curve files.
   - Delete deviation and pick behavior remains stable.
   - Curve disable/re-enable uses the currently selected track while preserving style.
7. Manual verification.
   - Create/import logs, deviation, and tops.
   - Delete one curve, all curves, deviation, pick, and well.
   - Disable a curve, select another track, re-enable it, and confirm it appears in the selected track with the previous visual style.
   - Reopen project and confirm no stale rows/files/UI entries.

## Non-Goals

- Do not delete shared dictionaries or shared geological objects just because one well used them.
- Do not redesign undo/redo unless needed to avoid data loss.
- Do not change import/export behavior except where delete cleanup requires it.
