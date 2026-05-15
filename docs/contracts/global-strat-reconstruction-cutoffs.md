# Global Stratigraphic Reconstruction Cutoffs

Status: Active
Branch: `feature/global-strat-reconstruction-cutoffs`

## Goal

Add two global model-level stratigraphic cutoffs for subsidence charts:

- `Reconstruct to strat unit`
- `Truncate below strat unit`

Both settings apply to the whole model, not to one well only. The selected boundary is based on the active stratigraphic chart unit, not on a local TopSet horizon id.

## User Problem

Wells can differ strongly by TD and by maximum geological age. Direct comparison is not always meaningful.

The app already has a per-well `Compare by marker` behavior, but model comparison needs global settings that can be applied consistently across single-well and multi-well subsidence views.

## Definitions

### Reconstruct to strat unit

Shows the model at the selected geological age.

If a strat unit is selected:

- all younger material above the reconstruction boundary is removed from the displayed model;
- only the section that already existed at the selected age remains;
- present-day anchors at `0 Ma` are not shown as reconstruction points;
- auto chart domains are resolved from the transformed curves;
- sea-level overlay is clipped to the reconstruction time window.

Example: selecting `Base Carboniferous (~398 Ma)` should show the basin/well state at that geological time, with younger units removed.

### Truncate below strat unit

Shows only the upper/common part of the section.

If a strat unit is selected:

- all older/deeper material below the selected boundary is hidden;
- the upper/younger section remains;
- auto chart domains are resolved from the transformed curves.

Example: selecting `Top Devonian` should hide everything below Devonian so wells with different TD and maximum age can be compared over a shared upper interval.

## Boundary Source

The global settings store `strat_unit_id`, not TopSet `horizon_id`.

Reason:

- TopSet horizons are local to TopSets and may differ across wells.
- Active TopSets can differ between wells.
- A global model setting should target the active stratigraphic chart unit.
- Per-well picks are used only to find a local depth boundary when available.

For each well:

- primary boundary age comes from the selected active strat chart unit;
- linked pick depth is used when available for metadata/depth-aware behavior;
- if a well does not have a linked pick for the selected strat unit, the age boundary still applies to curve clipping.

## Interpolation Rule

Cutoffs are age-based first.

If the selected age falls between existing burial path points:

- insert an interpolated point exactly at the cutoff age;
- interpolate depth linearly between the neighboring burial path points;
- never jump to the nearest marker.

This applies to both reconstruction and truncation.

## Stage 1 - Contract and Store State

- Add global view-store fields:
  - `subsidenceReconstructStratUnitId: number | null`
  - `subsidenceTruncateBelowStratUnitId: number | null`
- Persist them in project visual config.
- Reset them in visual config reset.
- Keep old projects compatible.

## Stage 2 - Shared Chart Transforms

- Replace the current `applyChartCutoff` marker helper with a clearer transform helper.
- Add pure utilities for:
  - finding age/depth extents after transform;
  - clipping a burial path to younger/equal ages;
  - clipping a burial path to older/equal ages;
  - inserting interpolated boundary points.
- Add unit tests for:
  - cutoff exactly on a point;
  - cutoff between points;
  - cutoff outside path range;
  - empty paths;
  - `Truncate below strat unit`;
  - `Reconstruct to strat unit`.

## Stage 3 - Models Settings UI

In `ModelsRootSettings`, directly below:

```text
Object
MODELS
```

Add:

```text
Reconstruct to strat unit    [Reset] [Strat unit]
Truncate below strat unit    [Reset] [Strat unit]
```

Behavior:

- `Reset` sets the value to `None`.
- Dropdown values come from the active stratigraphic chart.
- If there is no active strat chart, controls are disabled and show `None`.
- The current per-well `Compare by marker` UI should be replaced by `Truncate below strat unit` to avoid duplicate meanings.

## Stage 4 - Single-Well Chart

- Apply both global transforms in `SubsidenceCanvas`.
- `Truncate below strat unit` removes older/deeper portions below the selected age.
- `Reconstruct to strat unit` removes younger/present portions above the selected age.
- Auto age/depth domains use transformed curves.
- Manual domains remain user-controlled.
- Sea-level overlay is clipped to the visible transformed age domain.

## Stage 5 - Multi-Well Chart

- Apply the same global transforms in `MultiWellPanel`.
- The selected active strat chart unit is global.
- Each well is transformed by age, even if it lacks a linked local pick.
- If a linked local pick exists, keep it available for future depth-aware diagnostics.

## Stage 6 - Verification

Manual checks:

- Select no cutoff: charts match current behavior.
- Select `Truncate below strat unit`: older/deeper curves disappear; upper interval remains.
- Select `Reconstruct to strat unit`: younger/present part disappears; chart shows only the model existing at the selected age.
- Select a unit whose age falls between path points: curve ends at an interpolated boundary point, not at a nearby marker.
- Single-well and multi-well charts use the same selected global boundary.
- Reset returns each setting to `None`.

Automated checks:

- Frontend unit tests for chart transform utilities.
- Existing frontend test suite passes.

## Explicit Non-Goal For This Contract

This contract does not implement backend decompaction reconstruction.

The current implementation is a chart/model-view transform over calculated burial paths. This is acceptable for the first global comparison feature.

For future decompaction reconstruction, backend calculation must accept a `reconstruction_age_ma` parameter and calculate compaction from paleo-depth at the reconstruction age. That future stage must handle:

- paleo-depth based compaction;
- paleobathymetry at reconstruction age;
- sea level at reconstruction age;
- erosion/unconformity behavior at reconstruction age;
- stored result metadata for reconstruction parameters.

