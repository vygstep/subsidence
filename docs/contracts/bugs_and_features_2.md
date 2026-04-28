# Bugs and Features Contract 2

**Status:** Active backlog contract  
**Created:** 2026-04-28  
**Scope:** Log viewer correctness fixes, minimap rework, depth-type switching, subsidence chart polish, and new navigation controls.

---

## 1. Items

### LOD-001: LOD disabled by default (done)

**Type:** Bug / default value  
**Priority:** High

Problem: `lodEnabled` initialises to `true` in `viewStore.ts`. LOD resamples curves, which is confusing and hides data when first opening a project. Should be off by default so the user sees raw data immediately.

Fix: change `lodEnabled: true` → `lodEnabled: false` in `viewStore.ts`.

---

### LOD-002: Curves incomplete when LOD is off (done)

**Type:** Bug  
**Priority:** High

Problem: When LOD is disabled, not all curve data is rendered — looks like a stale LOD state is still used instead of switching back to full-resolution arrays.

Investigate: `wellDataStore` LOD fetch state, `DataTrack.tsx` curve source selection, `useCanvasRenderer.ts`.

---

### UX-011: New project button does not work with an open project (done)

**Type:** Bug / UX  
**Priority:** High

Problem: Clicking "New project" while a project is open does nothing (or behaves incorrectly). Expected flow:

1. If the current project has unsaved changes → show Save/Don't save/Cancel prompt.
2. After the user decides → close the current project.
3. Open the New Project dialog.

Fix location: `ProjectToolbar.tsx` — `handleNewProject` or equivalent handler.

---

### UX-012: Remove MD / TVD / TVDSS buttons from track sidebar

**Type:** UX cleanup  
**Priority:** Medium

Problem: Depth-type selector (MD / TVD / TVDSS) appears in the track/viewer sidebar. These controls do not belong there.

Fix: remove the buttons from the sidebar component. The depth-type control may move elsewhere (toolbar) or be removed pending a design decision.

---

### DEPTH-001: Depth type change has no effect (done)

**Type:** Bug  
**Priority:** High

Problem: Switching between MD / TVD / TVDSS does not change the displayed depths, even when only KB (kelly bushing) is loaded without a full deviation survey. At minimum, a KB offset should shift all depths when TVD/TVDSS is selected.

Investigate: depth-type switching logic, where KB is stored and accessed, `depthType` state consumers in `wellDataStore` and renderers.

---

### DEPTH-002: Full TVD/TVDSS coordinate system for the viewer

**Type:** Architectural refactoring  
**Priority:** Critical

Background from DEPTH-001 investigation:

The current implementation has two conflicting mechanisms:

1. **Label-only transform** (`DepthTrack.labelTransform`): scroll and curves stay in MD, only the depth scale labels are converted to TVD/TVDSS using `mdToTvd`. Simple but misleading — the viewer says "TVD" but internally everything is still MD.

2. **Curve reload** (`reloadCurvesForDepthBasis`): the backend returns curves with TVD/TVDSS depths on demand. But `scrollDepth` and `visibleDepthRange` stay in MD, causing a coordinate mismatch — `DataTrack` renders the wrong depth window.

Neither mechanism alone is correct. The current DEPTH-001 fix kept approach 1 (labels only), which is better than nothing but still wrong for deviated wells — curves plot in MD space while labels say TVD.

This matters because subsidence results depend on correct depth referencing. A deviated well with TVD-imported curves displayed in MD will show incorrect burial-history curves.

Required design:

When `depthType` is `TVD` or `TVDSS`:

1. **Scroll coordinate space switches to TVD/TVDSS.** `scrollDepth`, `visibleDepthRange`, and all depth arithmetic in `useSynchronizedScroll`, `useDepthScale`, `DataTrack`, `FormationTopLine`, `InteractionOverlay`, and `DepthCursor` must operate in the active coordinate space.

2. **Curves are fetched in the active coordinate space** via `reloadCurvesForDepthBasis`. `fullCurves` must also be reloaded (not just `curves`). When switching back to MD, MD arrays are restored.

3. **`scrollDepth` is remapped on mode switch.** When switching MD → TVD, the current `scrollDepth` (e.g., 500 MD) must be converted to the equivalent TVD value (e.g., `mdToTvd(500, tvdTable)`) so the view stays on the same geological horizon.

4. **`DepthTrack` shows raw values in TVD/TVDSS mode** — no `labelTransform` needed because curves and scroll are already in the target space.

5. **Formation depths use `depth_tvd` / `depth_tvdss` fields** directly (already stored in DB) instead of converting from `depth_md`.

6. **`minDepth` stays 0 in all modes.** `maxDepth` in `ViewerWorkspace` must be recomputed from the loaded curve arrays after mode switch.

7. **`LOD` fetch passes `depth_basis`** so downsampled curves also use the active coordinate space.

Key files to change:

- `viewStore.ts` — `setDepthType` must trigger coordinate remapping
- `wellDataStore.ts` — `reloadCurvesForDepthBasis` must update both `curves` and `fullCurves`; add a `depthBasis` field to track the current curve coordinate space
- `LogViewPanel.tsx` — pass `depthBasis` to `useSynchronizedScroll` and `LOD` effect
- `useSynchronizedScroll.ts` — accept `depthBasis` or use store directly
- `DepthTrack.tsx` — remove `labelTransform` in full TVD/TVDSS mode
- `FormationColumn.tsx` — use `depth_tvd`/`depth_tvdss` directly when in TVD/TVDSS mode
- `WellViewerToolbar.tsx` — restore `reloadCurvesForDepthBasis` call after coord remapping is in place

Pre-condition: deviation survey and KB must be loaded. If neither is available, TVD/TVDSS buttons should be disabled or show a warning.

---

### UX-013: Overview minimap — layout and depth range

**Type:** Bug + UX rework  
**Priority:** High

Problems:

1. The minimap uses `position: absolute; right: 0` and overlaps the rightmost track. It should sit **outside** the track area as a separate flex item, always to the right of all tracks.
2. The depth range in the minimap changes with data. It should always show **0 to TD** (total depth of the well), not just the loaded curve range.
3. The viewport indicator should still reflect the currently visible window within that 0–TD range.

Fix location: `WellOverviewMinimap.tsx`, `LogViewPanel.tsx` layout.

---

### UX-014: Add "Fit to well" button

**Type:** Feature  
**Priority:** Medium

Behaviour: scroll to depth 0 and set scale so the entire 0 → TD interval fits in the viewport height.

Location: `WellViewerToolbar.tsx`.

---

### UX-015: Add "Fit to contents" button

**Type:** Feature  
**Priority:** Medium

Behaviour: set scroll and scale so the actual data range (min curve depth → max curve depth) fits in the viewport height.

Location: `WellViewerToolbar.tsx`.

---

### SUBS-003: Timescale cell borders should be black

**Type:** Visual bug  
**Priority:** Low

Problem: The two-level geological timescale on subsidence charts has cell borders that are not visible enough (or wrong colour). All cell borders should be solid black.

Fix location: `GeologicalTimescale.tsx`, `styles/subsidence-panel.css`.

---

### SUBS-004: Subsidence chart — title spacing and colour

**Type:** Visual polish  
**Priority:** Low

Problem: The gap between the timescale and the chart title is too large (should be half the current value). The title text colour should be black (currently appears grey or styled differently).

Fix location: `SubsidenceCanvas.tsx` title div, `styles/subsidence-panel.css`.

---

## 2. Implementation order (suggested)

1. LOD-001 — one-line default fix, unblocks all LOD-related testing. (done)
2. LOD-002 — depends on LOD-001 being testable. (done)
3. UX-011 — standalone, high user-impact. (done)
4. DEPTH-001 — label-only fix, KB-only TVDSS. (done)
5. **DEPTH-002 — full TVD/TVDSS coordinate system. Critical for correctness. Large scope — requires dedicated implementation session.**
6. UX-013 — minimap layout rework, medium scope.
7. UX-012 — depends on UX-013 (buttons may move to toolbar).
8. UX-014, UX-015 — fit buttons, small scope.
9. SUBS-003, SUBS-004 — CSS-level polish, trivial.
