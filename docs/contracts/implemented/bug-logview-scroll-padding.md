# BUG: Log View Scroll Extent and Empty-Curve Banner

## Status

`implemented`

Completed on branch `bug/logview-scroll-padding`.

## Problem

When a well has formation tops but no imported log curves:

1. `ViewerWorkspace` shows `Well loaded. No curves imported yet.` above the log panel.
2. The log viewer depth range is based only on curve depths.
3. If no curves are loaded, `maxDepth` falls back to `1000`, ignoring `well.td_md` and formation tops.
4. Changing well TD in settings does not reliably expand the scrollable log-view range.
5. The view cannot scroll into padding above MD=0 or below TD.

## Desired Behavior

- Do not show the `Well loaded. No curves imported yet.` banner above the log panel.
- The log viewer should remain usable with a well and tops even when no curves exist.
- Scroll extent should include:
  - top padding: `MD = -100 m`
  - bottom padding: `well.td_md + 100 m`
- If curves or tops extend beyond TD, the rendered and scroll range should still include the deepest content plus bottom padding.
- When `well.td_md` changes, the scroll clamp and viewer extent should update.

## Padding Zone Behavior

The scroll range is intentionally larger than the editable well interval.

Definitions:

- `scrollMinDepth = -100`
- `wellTopDepth = 0`
- `wellBottomDepth = max(well.td_md, deepestCurveDepth, deepestFormationDepth, 0)`
- `scrollMaxDepth = wellBottomDepth + 100`

Visual behavior:

- The interval above `wellTopDepth` and below `wellBottomDepth` should be rendered as grey padding.
- Data tracks and formation track should not show grid, curves, lithology blocks, or zones inside the grey padding.
- The depth track should keep the depth scale readable while making padding visually distinct.
- The `wellTopDepth` and `wellBottomDepth` boundaries should remain visually clear.

Interaction behavior:

- Formation tops must not be placed in the padding zones.
- In edit-tops mode, clicks with `depth < wellTopDepth` or `depth > wellBottomDepth` should not create or move a top.
- The active-pick ghost line should not advertise a valid placement inside the padding zones.

## Invalid Top Depth UX

When a user enters a top depth outside the editable well interval `[0, well.td_md]`:

- Do not send the invalid change to the backend.
- Do not optimistically move the top.
- Restore the input to the previous saved value.
- Add a QC warning through `useNotificationStore.addQcWarnings`.
- Suggested warning text:
  `Top depth 8000.0 m is outside well interval 0.0-6000.0 m; change was ignored.`

This applies to:

- `TopPickSettings` depth input.
- `FormationTopsList` inline depth edit.
- `FormationTopsList` add action when the cursor or viewport midpoint is outside `[0, well.td_md]`.
- Dragging an existing top line outside `[0, well.td_md]`.

Backend validation is still required as the source of truth:

- Reject `POST /wells/{well_id}/formations` when `depth_md` is outside `[0, well.td_md]`.
- Reject `PATCH /wells/{well_id}/formations/{formation_id}` when the resolved MD is outside `[0, well.td_md]`.
- Reject `POST /top-sets/{top_set_id}/picks` when `depth_md` is outside `[0, well.td_md]`.
- The PATCH rule applies to direct `depth_md` and to `depth_tvd` / `depth_tvdss` after conversion to MD.
- Existing invalid historical tops may still be loaded and shown, but new writes must not create more invalid tops.

Drag behavior:

- While dragging an existing top line, clamp the visual line to `[0, well.td_md]`.
- On release, save the clamped boundary depth if the pointer went outside the interval.
- Add a QC warning when clamping occurs:
  - `Top depth was limited to 0.0 m.`
  - `Top depth was limited to well TD 6000.0 m.`

## Additional Fit Behavior

Current behavior:

- `Fit well` and `Fit data` are visually enabled when a well exists.
- Both handlers return early when `fullCurves.length === 0`, so a well with tops but no curves gets no fit behavior.
- `Fit data` only considers curve depth ranges and ignores picked formation tops.

Desired behavior:

- `Fit well` should fit to the shared log-view extent whenever a well exists:
  - `minDepth = -100`
  - `maxDepth = max(well.td_md, deepestCurveDepth, deepestFormationDepth, 0) + 100`
- `Fit data` should fit to visible data content:
  - curve depth ranges when curves exist
  - picked formation depths when tops exist
  - both curves and tops when both exist
- `Fit data` may be disabled or no-op only when there are neither curves nor picked tops.
- A well with tops but no curves must still support `Fit data`.

## Implementation Plan

### Step 1: Remove empty-curve banner

File:

- `frontend/src/components/layout/ViewerWorkspace.tsx`

Remove the conditional banner for `curves.length === 0`.

### Step 2: Centralize log-view depth extent

Files:

- `frontend/src/components/layout/ViewerWorkspace.tsx`
- possibly a new small helper under `frontend/src/utils/`

Compute log-view bounds from:

- `well.td_md`
- loaded curve depth ranges
- picked formation depths

Use:

- `minDepth = -100`
- `wellTopDepth = 0`
- `wellBottomDepth = max(well.td_md, deepestCurveDepth, deepestFormationDepth, 0)`
- `maxDepth = wellBottomDepth + 100`

### Step 3: Apply extent consistently

Files:

- `frontend/src/components/layout/ViewerWorkspace.tsx`
- `frontend/src/components/logview/WellOverviewMinimap.tsx`
- `frontend/src/components/logview/WellViewerToolbar.tsx`
- `frontend/src/components/logview/LogViewPanel.tsx`
- `frontend/src/components/logview/DepthTrack.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/logview/FormationColumn.tsx`
- `frontend/src/components/interaction/InteractionOverlay.tsx`
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/layout/FormationTopsList.tsx`
- `frontend/src/components/interaction/FormationTopLine.tsx`
- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/top_sets.py`

Pass or use the same well extent for:

- scroll clamp
- minimap
- Fit well
- grey padding rendering
- edit-tops placement guard

Update `Fit data` to include picked formation tops as fit content, not only curve data.

### Step 4: Verify manually

Checks:

- Well with tops and no curves shows no empty-curve banner.
- Viewer can scroll to `-100 m`.
- Viewer can scroll to `TD + 100 m`.
- Increasing TD in well settings extends the scrollable range.
- Tops remain visible with no curves.
- `Fit well` works with a well that has tops but no curves.
- `Fit data` fits to tops when no curves exist.
- `Fit data` fits to the combined curve and top range when both exist.
- The `-100..0` and `TD..TD+100` intervals are grey.
- Track grid and data are not visible inside grey padding zones.
- Edit-tops clicks in grey padding do not place or move tops.
- Entering a settings top depth below `0` or above `TD` shows a QC warning and leaves the previous saved depth unchanged.
- Inline top-list depth edits below `0` or above `TD` show a QC warning and leave the previous saved depth unchanged.
- Dragging a top above `0` or below `TD` clamps to the boundary, saves the boundary depth, and shows a QC warning.
- Backend formation create/update rejects out-of-well MD values.
- Backend TopSet pick creation rejects out-of-well MD values.

## Implementation Summary

- Removed the empty-curve banner from the log-view workspace.
- Centralized the log-view depth extent around the editable well interval and render padding:
  - scroll minimum: `-100 m`
  - well top: `0 m`
  - well bottom: `max(well.td_md, deepest curve depth, deepest picked top depth, 0)`
  - scroll maximum: `wellBottomDepth + 100 m`
- Added grey padding-zone rendering for depth, curve, and formation tracks.
- Kept curve grids, curve data, lithology zones, and top-placement affordances out of padding zones.
- Updated minimap, scroll clamp, `Fit well`, and `Fit data` to use well/tops/curves consistently.
- Added frontend guards and QC warnings for invalid top depth input, add actions, and drag clamping.
- Added backend validation for formation create/update and TopSet pick creation.
- Added API regression tests for invalid out-of-well top writes.

## Verification

- Frontend: `npm run test -- --run` in `frontend` passed: 49 tests.
- Backend full suite: `pytest tests` in `app` had 82 passed and 11 existing failures unrelated to this contract.
- Targeted backend API tests passed:
  - `test_formation_api_rejects_depth_outside_well_td`
  - `test_formation_api_rejects_invalid_depth_update_without_mutation`
  - `test_top_set_pick_api_rejects_depth_outside_well_td`
