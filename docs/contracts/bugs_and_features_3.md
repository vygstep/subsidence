# Bugs and Features Contract 3

**Status:** Active backlog contract  
**Created:** 2026-04-29  
**Scope:** Settings panel polish, subsidence chart selectability, Data Manager restructuring (Wells / TOPS / Models).

---

## Session items (2026-04-29) — implemented

### BF3-001: Tops settings — Zone labels / Marker labels (done)

**Type:** Feature  
Added `showLabels` (zone block labels, always center) and `showMarkerLabels` + `markerLabelPosition`
(Left/Center/Right) to `FormationsTrackConfig`. Per-formation position override stored in
`WellViewState.topLabelPositions`. Settings exposed in `TopsSettings` (global) and `TopPickSettings`
(per-formation with "— global" fallback option).

---

### BF3-002: Horizontal grid toggle + grid/label color (done)

**Type:** Feature  
Added `showHorizontalGrid` and `gridColor` to `TrackConfig` (curve tracks) and
`showHorizontalGrid`, `gridColor`, `labelColor` to `DepthTrackConfig`. Renamed "Show grid" →
"Show vertical grid" in `CurveTrackSettings`. All renderers accept optional color overrides.

---

### BF3-003: Subsidence Y-axis depth range (partial — depth min/max in SubsidenceControls)

**Type:** Feature  
Removed `tdMd` from Y-axis auto-range; chart now fits to burial data. Added `subsidenceDepthMinM`
/ `subsidenceDepthMaxM` to `viewStore`. Controls were temporarily placed in `SubsidenceControls`
pending BF3-005 (proper Settings integration).

---

### BF3-004: Curve "interpolation stick" in null regions (done)

**Type:** Bug fix  
`computeGapThreshold` was computed from the 2-point clipped slice, making threshold = gap × 5,
so the gap was never detected. Fix: export `computeGapThreshold`, compute it from the full
(unclipped) curve data in `DataTrack`, pass as `gapThresholdOverride` to `drawCurve`.

---

## Pending

### BF3-005: Subsidence charts — selectable objects in Settings panel

**Type:** Feature  
**Priority:** High  
**Depends on:** BF3-003 (depth controls need to move here from SubsidenceControls)

Currently `SubsidenceCanvas` (single-well total subsidence) and `MultiWellPanel` (multi-well
comparison) are plain canvas elements with no selection mechanism. Settings for them do not
appear in the Settings panel.

**Plan:**

1. Add `{ type: 'subsidence-chart'; chartType: 'single' | 'multi' }` to `SelectedObject` union
   in `workspaceStore.ts`.

2. Make chart titles clickable in `SubsidenceCanvas` and `MultiWellPanel`:
   - `onClick` → `useWorkspaceStore.getState().setSelectedObject(...)`
   - Visual feedback: highlight title / add `--selected` CSS class.

3. Create `SubsidenceChartSettings.tsx`:
   - Shows chart type (Single-well / Multi-well).
   - **Depth min (m)** and **Depth max (m)** inputs (empty = auto-fit to data).
   - Reads/writes `subsidenceDepthMinM` / `subsidenceDepthMaxM` from `viewStore`.

4. Register in `SettingsInspector.tsx` — new `subsidence-chart` case.

5. Remove depth min/max inputs from `SubsidenceControls.tsx` (they live in Settings now).

**Files:** `workspaceStore.ts`, `SubsidenceCanvas.tsx`, `MultiWellPanel.tsx`,
`SubsidenceControls.tsx`, `SettingsInspector.tsx`, new `SubsidenceChartSettings.tsx`.

---

### BF3-006: Data Manager restructuring — Wells / TOPS / Models

**Type:** Major feature  
**Priority:** Medium  
**Scope:** Requires frontend + backend changes

Currently the Data Manager has tabs: **Wells** | **Templates** | **Strat-charts**.  
Proposed new structure: **Wells** | **TOPS** | **Models**

#### BF3-006-A: Wells tab (minimal change)

Keep existing well tree (well → LAS group → curves, TOPS group → formations, Deviation, Zones).
No structural change required here; secondary well-level items (formation list, curve list) remain
inside each well node.

#### BF3-006-B: TOPS tab — cross-well formation browser

Dedicated tab listing all formation tops across all loaded wells in a flat or grouped list.

- Each formation top is a selectable row → opens `TopPickSettings` in the Settings panel.
- Filter/search by name.
- Group by: well | stratigraphic unit | kind (conformable / unconformity).
- Bulk operations: show/hide all, change color, link to strat unit.
- Backend: may need a `/api/formations/all` or cross-well query endpoint.

#### BF3-006-C: Models tab — subsidence model objects

Dedicated tab listing all 5 computation model types. Each is a selectable node with its own
Settings panel.

| Model | Current location | Planned SelectedObject type |
|---|---|---|
| Total subsidence (single-well) | SubsidenceCanvas | `subsidence-chart` `single` |
| Multi-well comparison | MultiWellPanel | `subsidence-chart` `multi` |
| Decompaction | TBD | `decompaction-chart` |
| Model 4 | TBD | TBD |
| Model 5 | TBD | TBD |

Models 3–5 names/types TBD — to be confirmed with domain logic.

**Each model node shows in Settings:**
- Display toggles (burial curves, formation fills, etc.)
- Y-axis depth range (min/max)
- Chart-specific parameters

**Note:** BF3-005 is a prerequisite — implement single/multi-well selectability first as a
stepping stone before the full Models tab.

---

## Notes

- `bugs_and_features.md` and `bugs_and_features_2.md` are in `docs/contracts/implemented/`.
- This file lives in `docs/contracts/` until all items are complete, then moves to `implemented/`.
