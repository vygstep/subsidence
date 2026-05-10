# Subsidence Chart Domains, Zoom, and Marker Cutoff

Branch: `feature/subsidence-chart-domains-zoom-marker-cutoff`

## Status

`in progress`

## Goal

Improve single-well and multi-well subsidence chart navigation and comparison:

- add configurable age ranges alongside existing depth ranges;
- add explicit Auto controls for depth and age ranges;
- add Fit data for both subsidence charts;
- make both charts zoomable;
- add per-well Compare by marker settings under MODELS;
- fix single-well age domain so it is based only on the active well's rendered data.

## Product Rules

### Chart Ranges

- Each subsidence chart has independent depth and age range settings:
  - single-well chart;
  - multi-well chart.
- `null` range values mean auto.
- Auto depth range uses visible chart data with padding:
  - top padding = `min(10% of visible depth span, 300 m)`;
  - bottom padding = `min(10% of visible depth span, 300 m)`;
  - final minimum depth may be above KB/0 by the allowed top padding.
- Auto age range uses visible chart data after marker cutoff.
- Depth and age settings must be saved in project visual config.

### Fit Data

- Fit data resets the target chart to auto depth and age ranges.
- If the single-well chart is selected, Fit data targets single-well ranges.
- If the multi-well chart is selected, Fit data targets multi-well ranges.
- If no subsidence chart is selected, Fit data targets the single-well chart.

### Zoom

- Single-well and multi-well charts are zoomable.
- Mouse wheel over the plot zooms around the cursor.
- Zoom writes explicit depth and age min/max values to `viewStore`.
- Fit data returns the chart to auto ranges.

### Compare by Marker

- `Compare by marker` is configured in `MODELS -> Settings`.
- It is a per-well setting, because model inputs are per well.
- The settings block stays next to existing per-well model settings:
  - `Well`;
  - `Active TopSet`;
  - `Sea level curve`;
  - `Compare by marker`;
  - `Marker`;
  - `Reset`.
- Marker choices come from the selected well's active TopSet.
- `Reset` selects the oldest/deepest marker in the selected well's active TopSet.
- Compare by marker is a display cutoff in this contract, not a backend recalculation input.
- Multi-well chart applies each well's own marker cutoff.
- If a well has Compare by marker disabled, that well is rendered over the full available range.
- If Compare by marker is enabled but the selected marker cannot be resolved for that well,
  the well falls back to full range and does not block other wells.

## Architecture Decisions

- Existing `Active TopSet` and `Sea level curve` remain backend per-well settings exposed through well inventory.
- New Compare by marker state is stored in project visual config first:

```ts
subsidenceCompareByMarkerByWellId: Record<string, boolean>
subsidenceCompareMarkerHorizonIdByWellId: Record<string, number | null>
```

- This is intentionally frontend display state for now. If marker cutoff becomes a calculation input,
  persist it in backend per-well model settings in a later contract.
- Domain and cutoff logic should be extracted into small shared frontend helpers rather than duplicated
  independently in `SubsidenceCanvas.tsx` and `MultiWellPanel.tsx`.

## Implementation Plan

### S1: Fix single-well age domain

- Change single-well auto age domain to use the rendered `subsidenceCurves` for the active well.
- Do not use unrelated/global formation inventory for chart age domain.
- Preserve existing fallback when there are no curves.

Status: done.

Verification:

- Unit/helper test proves single chart age domain follows rendered curves only: `2 passed`.

### S2: Add age range settings and Auto controls

- Add to `viewStore`:
  - `subsidenceSingleAgeMin`
  - `subsidenceSingleAgeMax`
  - `subsidenceMultiAgeMin`
  - `subsidenceMultiAgeMax`
  - setters for each.
- Extend visual config read/write/hydration.
- Extend `SubsidenceChartSettings`:
  - `Depth min (m)`;
  - `Depth max (m)`;
  - depth `Auto`;
  - `Age min (Ma)`;
  - `Age max (Ma)`;
  - age `Auto`.

Status: done.

Verification:

- Frontend visual config hydration test covers new fields.
- Frontend tests: `59 passed`.

### S3: Shared chart-domain helper and Fit data

- Add shared helper for single/multi chart domains:
  - compute visible age/depth extents from curves;
  - apply marker cutoff;
  - apply 10% capped depth padding;
  - apply manual range overrides.
- Add Fit data action:
  - resets selected chart depth and age ranges to `null`;
  - keeps marker cutoff settings unchanged.
- When a range field is set to auto (`null`), its input placeholder shows the current
  computed auto value instead of the literal word `auto`.

Status: done.

Verification:

- Helper tests for auto depth padding and manual override behavior.
- Frontend tests: `61 passed`.

### S4: Zoom

- Add wheel zoom handling to both chart wrappers.
- Zoom around cursor using current effective age/depth ranges.
- Store explicit min/max in `viewStore`.
- Clamp invalid/inverted ranges.
- Middle mouse drag pans the chart.
- Panning and zoom-out are clamped to the current auto data bounds:
  - age cannot move outside visible data age extent;
  - depth cannot move outside visible data extent with the allowed auto padding.
- Middle-drag pan must preserve the current scale; when it reaches a bound, it stops instead of rescaling.

Status: done.

Verification:

- Helper tests for zoom range math.
- Helper tests for pan/clamp range math.
- Frontend tests: `63 passed`.
- Manual smoke test: wheel zoom works on both charts, Fit data restores auto.

### S5: Models settings Compare by marker

- Extend `ModelsRootSettings` under `Sea level curve`:
  - checkbox `Compare by marker`;
  - marker dropdown from selected well's active TopSet horizons;
  - `Reset` button selecting oldest/deepest marker.
- Disable marker dropdown when no active TopSet is selected or Compare by marker is off.
- Persist per-well compare settings in visual config.

Status: done.

Verification:

- Frontend test for viewStore persistence if practical.
- Visual config hydration test covers compare settings.
- Frontend tests: `63 passed`.
- Manual smoke: switch selected well in Models settings and verify each well keeps its own marker setting.

### S6: Apply marker cutoff in charts

- Single-well chart:
  - apply current well's cutoff before drawing and domain calculation.
- Multi-well chart:
  - apply each well's cutoff before drawing and domain calculation.
- Geological timescale uses the effective age range.
- Crosshair uses the effective age/depth range.

Status: in progress.

Verification:

- Frontend tests pass.
- Manual smoke:
  - single chart trims below selected marker;
  - multi chart trims each well by its own selected marker;
  - auto depth/age update after cutoff;
  - missing marker does not break chart rendering.

## Non-goals

- No backend calculation changes.
- No database schema changes.
- No persistence of Compare by marker as backend model input.
- No implementation of planned subsidence models beyond existing available model behavior.
- No redesign of the overall subsidence panel layout.

## Verification Commands

Ask before running.

```bash
cd frontend
npm run test -- --run
```

```bash
cd app
pytest tests
```
