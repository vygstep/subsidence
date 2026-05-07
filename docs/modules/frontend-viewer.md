# Frontend Viewer Module

This module covers log viewer rendering, interaction overlays, and styling boundaries.

---

## Main Viewer Files

Files:

- `frontend/src/components/logview/LogViewPanel.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/logview/DepthTrack.tsx`
- `frontend/src/components/logview/FormationColumn.tsx`
- `frontend/src/components/logview/TrackHeaderRow.tsx`
- `frontend/src/components/logview/TrackHeader.tsx`
- `frontend/src/components/logview/WellOverviewMinimap.tsx`
- `frontend/src/components/interaction/InteractionOverlay.tsx`
- `frontend/src/components/interaction/FormationTopLine.tsx`
- `frontend/src/components/interaction/DepthCursor.tsx`
- `frontend/src/components/interaction/CurveTooltip.tsx`
- `frontend/src/utils/curvePresets.ts`

Responsibilities:

- Render depth axis.
- Render curve tracks.
- Render formations and tops.
- Handle track headers, selection, and drag/reorder behavior.
- Synchronize scroll and visible depth.
- Apply mnemonic-based curve defaults.

---

## Rendering Strategy

The viewer uses a hybrid model:

- Canvas for dense curve rendering.
- SVG/HTML overlays for interactive objects such as formation tops and headers.

This avoids DOM overload from curve samples while keeping interaction code simple.

---

## Depth Extent and Padding

The log viewer uses a shared well extent for scroll, minimap, fit actions, padding rendering, and top placement rules.

Definitions:

- `scrollMinDepth = -100`
- `wellTopDepth = 0`
- `wellBottomDepth = max(well.td_md, deepestCurveDepth, deepestPickedTopDepth, 0)`
- `scrollMaxDepth = wellBottomDepth + 100`

Rules:

- The `-100..0` and `wellBottomDepth..wellBottomDepth+100` intervals are padding zones.
- Padding zones are rendered grey.
- Curve grids, curve data, lithology zones, and top placement affordances must not render inside padding zones.
- Depth-track labels may remain visible in padding zones so the scroll context stays readable.
- New or moved tops are only valid inside `[0, well.td_md]`; frontend guards show QC warnings and backend API validation remains the source of truth.
- `Fit well` uses the full scroll extent; `Fit data` fits curves and picked tops together, and also works when a well has tops but no curves.

---

## Renderers and Hooks

Files:

- `frontend/src/renderers/*.ts`
- `frontend/src/hooks/*.ts`

Responsibilities:

- Draw curves, fills, grids, and clipping windows.
- Manage canvas render lifecycle.
- Keep pure rendering logic testable.

Rule:

- Renderer changes should prefer pure unit tests.
- Do not extract clipping/interpolation from `DataTrack.tsx` without preserving existing depth-clipping unit coverage.

---

## Styling

File:

- `frontend/src/index.css`

Risk:

- This file is currently too large and contains styles for many UI domains.

Planned split after behavior is stable:

- App layout shell.
- Toolbar/dialogs.
- Data Manager.
- Log viewer.
- Subsidence panel.
- Settings/status.

---

## Viewer Refactor Risks

- `DataTrack.tsx` combines clipping, interpolation, fill preparation, and canvas drawing orchestration.
- `TrackHeaderRow.tsx` is the track selection/reorder surface.
- `FormationTopLine.tsx` in `components/interaction` owns editable top interactions.
- `curvePresets.ts` must stay aligned with backend curve dictionaries when defaults change.

---

## Common Bug Areas

Start here for:

- Track display wrong.
- Curve rendering wrong.
- Formation drag wrong.
- MD/Formations track selection wrong.
- Viewer scroll/layout bug.
- Track reorder bug.
- Wrong curve fill rendering.
