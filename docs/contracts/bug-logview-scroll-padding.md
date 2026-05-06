# BUG: Log View Scroll Extent and Empty-Curve Banner

## Status

`todo`

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
- `maxDepth = max(well.td_md, deepestCurveDepth, deepestFormationDepth, 0) + 100`

### Step 3: Apply extent consistently

Files:

- `frontend/src/components/layout/ViewerWorkspace.tsx`
- `frontend/src/components/logview/WellOverviewMinimap.tsx`
- `frontend/src/components/logview/WellViewerToolbar.tsx`

Pass or use the same well extent for:

- scroll clamp
- minimap
- Fit well

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
