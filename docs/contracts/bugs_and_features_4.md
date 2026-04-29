# Bugs and Features — Contract 4

## Status legend
`todo` · `partial` · `done`

---

## BF4-001: Marker lines clipped to track area (todo)

**Problem**: Formation top lines in `FormationTopLine.tsx` draw an SVG `<line x1={0} x2="100%">`.
The container SVG in `InteractionOverlay.tsx` has `overflow: 'visible'`, so lines extend into
empty space to the right of the last track.

**Root cause**: `InteractionOverlay` SVG (`frontend/src/components/interaction/InteractionOverlay.tsx`)
sets `overflow: 'visible'` so that floating labels can render near SVG edges. But the actual horizontal
line is supposed to stop at the right edge of the tracks, not overflow.

**Fix**:
- Add a `<clipPath id="track-bounds">` inside the InteractionOverlay SVG that defines a rect from
  `(0, 0)` to `(100%, 100%)` — i.e., the SVG's own bounding box.
- Apply `clipPath="url(#track-bounds)"` on the `<line>` element only inside each `FormationTopLine`,
  leaving the label `<rect>` and `<text>` elements unclipped (they're already within bounds).
- Alternative simpler fix: change the outer SVG style to `overflow: 'hidden'` if labels do not
  render outside the SVG bounding box. Verify that right-position labels use
  `transform="translate(-122, 0)"` (they do) and are therefore inside the bounding box — if
  confirmed, `overflow: 'hidden'` is sufficient and no clipPath is needed.

**Affected files**:
- `frontend/src/components/interaction/InteractionOverlay.tsx` (SVG overflow)
- `frontend/src/components/interaction/FormationTopLine.tsx` (line element)

---

## BF4-002: Remove object counters from data manager tree (todo)

**Problem**: Every tree root node in the data manager shows a count badge next to its label
(e.g., `WELLS (3)`, `ZONES (2)`, `Models (5)`). These are visual noise the user wants removed.

**Remove `tree-node__count` spans from**:
- `WellDataPanel.tsx` line ~278: `WELLS` root — `<span className="tree-node__count">{wells.length}</span>`
- `WellDataPanel.tsx` line ~489: `ZONES` root — `<span className="tree-node__count">{zoneSets.length}</span>`
- `WellDataPanel.tsx` line ~511: each ZoneSet child — `<span className="tree-node__count">{zoneSet.zones.length}</span>`
- `WellDataPanel.tsx` `ModelsRoot` component line ~169: `<span className="tree-node__count">{MODEL_NODES.length}</span>`

**Remove `tree-node__item-meta` spans from `StratChartTab.tsx`**:
- Per-chart item: `<span className="tree-node__item-meta">{chart.unit_count} units</span>` (line ~60)
- Sea level curves root: `<span className="tree-node__item-meta">{seaLevelCurves.length}</span>` (line ~87)
- Per-curve: `<span className="tree-node__item-meta">{curve.point_count} pts</span>` (line ~105)

**Affected files**:
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/StratChartTab.tsx`

---

## BF4-003: StratCharts tab restructure (todo)

### BF4-003-A: Rename tab label globally

Current tab label in `DataManagerTopPane.tsx` line 169: `"StratCharts"`.
Rename to `"Charts"` everywhere:
- `DataManagerTopPane.tsx`: the `<button>` text and the `activeSidebarTab === 'strat-charts'` type literal
- Propagate the type `'strat-charts'` string value — keep the internal key unchanged (`'strat-charts'`)
  to avoid a cascade of store/prop refactors; only the display label changes.

### BF4-003-B: Strat Charts root node with collapsible children

Currently `StratChartTab.tsx` renders a flat list of charts. Restructure to match the WELLS/ZONES
pattern in `WellDataPanel.tsx`:

```
▶ STRAT CHARTS                   ← expandable root row (toggle triangle)
    ○ ICS 2023  [built-in]       ← radio for active selection
    ○ My custom chart            ← user chart
```

Implementation:
- Wrap the chart list in a root node styled like `tree-node--root` with a `TreeToggleButton`
  (same component as used in `WellDataPanel`) using key `'strat-charts-root'` in `DataManagerContext`.
- On click of the root label: set selected object `{ type: 'strat-charts-root' }` (for future use).
- Charts appear only when expanded; expanded by default.
- Charts still use radio buttons for active selection (no change to that logic).
- Delete button per chart stays on each chart row.

### BF4-003-C: Sea level curves as collapsible root

Currently in `StratChartTab.tsx` the "Sea level curves" section is a root label followed by an
always-visible flat list. Restructure to match the pattern used for ZoneSets (expandable):

```
▶ SEA LEVEL CURVES               ← expandable root row (toggle triangle)
    Haq 1987  [built-in]
    My curve
```

Implementation:
- Add a `TreeToggleButton` to the "Sea level curves" root row using key `'sea-level-curves-root'`
  in `DataManagerContext`.
- Show curve list only when expanded; expanded by default.
- Each curve row layout stays the same (name, built-in badge, delete button).
- Root row click: `setSelectedObject({ type: 'sea-level-curves-root' })` (already works).

**Affected files**:
- `frontend/src/components/layout/DataManagerTopPane.tsx` (tab label)
- `frontend/src/components/layout/StratChartTab.tsx` (all three sub-items)
- `frontend/src/components/layout/dataManager/DataManagerContext.tsx` (new expand keys)

---

## BF4-004: Curve settings accessible when log is disabled (todo)

**Problem**: When a log curve's visibility checkbox is unchecked, the user cannot change the
curve's settings. The exact failure mode needs investigation.

**Hypothesis**: In `CurveSettings.tsx`, the `containingTrack` is found by searching
`viewState.tracks` for a track that contains the curve. When a curve is unchecked (invisible),
it may be absent from `viewState.tracks[*].curves`, making `containingTrack` null. Some settings
(e.g., lithology section) depend on `containingTrack` but the core rendering settings (color,
scale, line style) do not — so they should still work.

**Investigation step**: Check whether `onToggleCurve` in the workspace store removes the curve
from the track config when unchecking, or merely hides it. If it removes the config, the curve's
`selectedCurveConfig` passed to `CurveSettings` would lose persisted values on next select.

**Fix requirements**:
1. Curve visibility (checked/unchecked) must NOT affect the ability to view or edit settings
   in `CurveSettings.tsx`.
2. If unchecking removes the curve config from the track: stop doing that. Only hide it via a
   separate visibility flag; keep the config entry in the track.
3. `CurveSettings` must always render fully (no read-only or disabled mode based on visibility).
4. Clicking on an unchecked curve item in the tree must reliably trigger `onSelectCurve` and
   show its settings panel.

**Affected files**:
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- Workspace store / `onToggleCurve` implementation (investigate first)

---

## BF4-005: Lithology curve types — discrete vs fraction (todo)

**Problem**: The "Lithology composition" section in `CurveSettings.tsx` (line 184) shows a
lithology code picker for ALL curves, including GR, RHOB, etc. This is confusing. Lithology
is only meaningful for specific curve families.

**User requirement**: Two distinct lithology curve types:

| Type | Family code | Description | Setup |
|---|---|---|---|
| `lithology_discrete` | `lithology_discrete` | Each sample value is an integer code (e.g., 1=sand, 2=shale). Always 100% one lithology. | User creates code-to-lithology mapping in Templates, assigns a lithology set. |
| `lithology_fraction` | `lithology_fraction` | Each sample is a fraction (0–1 v/v) for one lithology component. Multiple fraction curves combine in a lithology track. | Current implementation — assign a lithology code per curve. |

**Implementation plan**:

### Step 1: Backend — new `curve_type` value
- Add `'lithology_discrete'` to the allowed `curve_type` values on the curve schema
  (`app/src/subsidence/data/schema.py`, `CurveConfig` or similar).
- Backend already supports `continuous` and `discrete` (for `discrete_code_map` rendering).
  `lithology_discrete` is separate: it implies each integer value is a lithology code, not just
  a generic enum.

### Step 2: Frontend — CurveSettings conditional sections

Change `CurveSettings.tsx`:
- Remove the always-visible "Lithology composition" section header and the single lithology code
  picker that currently appears for all curves.
- Instead, determine rendering mode from `dictMatch.family_code` OR `selectedCurveConfig.curve_type`.
- **If `curve_type === 'lithology_discrete'`**:
  - Show "Lithology set" selector: a `<select>` from available lithology sets (fetched from store).
  - Each integer value in the curve maps to a lithology code in the selected set.
  - Show a code-mapping table: integer value → lithology entry from set (read-only, derived from set).
- **If `curve_type === 'lithology_fraction'` (or `isLithologyTrack`)**:
  - Show the existing "Lithology code" picker (assigns this fraction curve to one component).
- **Otherwise**: hide the lithology section entirely.

### Step 3: Rendering — discrete lithology track
- `lithologyCompositionRenderer.ts` currently handles fraction bands.
- Add a `drawLithologyDiscrete` path: for each depth sample, look up the integer code in the
  lithology set, fill the full track width with that lithology's color/pattern (no stacking).
- In track rendering, detect `curve_type === 'lithology_discrete'` and use the discrete path.

### Step 4: Rendering mode selector
- In `CurveSettings`, add `'lithology_discrete'` as a new option in the "Rendering" dropdown
  (currently Line / Blocks). Label: "Lithology (discrete)". Add "Lithology (fraction)" option too.
- The "Blocks" mode (generic discrete blocks) remains as-is.

**Affected files**:
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/renderers/lithologyCompositionRenderer.ts` (new discrete path)
- `app/src/subsidence/data/schema.py` (new curve_type value)
- Track rendering pipeline (wherever `curve_type` drives rendering dispatch)

---

## BF4-006: Well color — swatch only, oval marker (todo)

### BF4-006-A: Remove hex code text input in WellSettings

In `WellSettings.tsx` lines 62–74:

```tsx
<div className="sf-color-field">
  <input type="color" ... />
  <input type="text" value={wellInspectorDraft.color_hex} ... />  ← remove this
</div>
```

Remove the `<input type="text">` for the hex code. Keep only the `<input type="color">` swatch.
The color picker itself already shows the current color visually.

### BF4-006-B: Oval/pill well color marker in tree

In `WellDataPanel.tsx` line 324:
```tsx
<span className="tree-node__color-swatch" style={{ backgroundColor: item.color_hex }} />
```

Change `tree-node__color-swatch` to render as a horizontal pill/ellipse instead of a square.
CSS update in `data-manager.css` (or whichever file defines `.tree-node__color-swatch`):
```css
.tree-node__color-swatch {
  display: inline-block;
  width: 18px;
  height: 10px;           /* shorter height → pill shape */
  border-radius: 5px;     /* oval/pill */
  flex-shrink: 0;
}
```

**Affected files**:
- `frontend/src/components/layout/settings/WellSettings.tsx`
- `frontend/src/styles/data-manager.css` (or wherever `.tree-node__color-swatch` is defined)

---

## BF4-007: Tops settings — dropdown arrow overlap + sea level override (todo)

### BF4-007-A: Select dropdown arrow overlaps text

In `TopPickSettings.tsx`, the native `<select>` elements ("Kind" and "Marker position") suffer from
the browser arrow overlapping the selected text due to insufficient `padding-right`.

Fix via CSS: wherever `.sf-row select` or the global `select` style is defined, add:
```css
select {
  padding-right: 24px;   /* or 2rem — reserve space for the native arrow */
  text-overflow: ellipsis;
}
```

Check if this also affects other `<select>` elements elsewhere in the UI (WellSettings, ZoneSettings,
CurveSettings). Apply globally to all `<select>` within `.sf-row` or the settings panel scope.

**Affected files**:
- `frontend/src/styles/settings.css` or `frontend/src/styles/app.css` (wherever `select` is styled)

### BF4-007-B: Sea level value override per formation

Currently `TopPickSettings.tsx` lines 163–168 show the sea level value as read-only:
```tsx
{activeCurveId !== null && (
  <div className="sf-row">
    <span>Sea level (m)</span>
    <span>{seaLevelAtAge.toFixed(1)}</span>
  </div>
)}
```

The value is calculated from the active curve and the formation's `age_ma`. The user wants the
ability to override this per-formation, with a reset button to return to the curve-calculated value.

**Backend**:
- Add `sea_level_m_override: float | None` field to the formation schema
  (`app/src/subsidence/data/schema.py`, `FormationTop` model and DB table).
- Schema migration: add `ALTER TABLE formations ADD COLUMN sea_level_m_override REAL` if not exists.
- PATCH endpoint for formations (`/api/wells/{well_id}/formations/{formation_id}`) already exists;
  add `sea_level_m_override` to the accepted patch fields.

**Frontend**:
- In `TopPickSettings.tsx`, change the sea level row to an editable input with a reset button:
  ```tsx
  {activeCurveId !== null && (
    <div className="sf-row">
      <span>Sea level (m)</span>
      <input
        type="number"
        step="0.1"
        value={draftSeaLevel ?? ''}
        onChange={(e) => setDraftSeaLevel(e.target.value ? Number(e.target.value) : null)}
        onBlur={() => void saveSeaLevelOverride()}
      />
      <button type="button" onClick={() => void resetSeaLevelOverride()} title="Reset to curve">↺</button>
    </div>
  )}
  ```
- The "reset" button clears `sea_level_m_override` (sets to `null`) and restores display to the
  curve-calculated value.
- `draftSeaLevel` is initialized from `selectedFormation.sea_level_m_override ?? seaLevelAtAge`.
- `FormationTop` type in `frontend/src/types/` must add `sea_level_m_override: number | null`.

**Affected files**:
- `frontend/src/styles/app.css` or `settings.css` (BF4-007-A)
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/types/` (FormationTop interface)
- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py` (migration)
- `app/src/subsidence/api/` (formation PATCH)

---

## BF4-008: Sea level curve selector — move to Models only (todo)

**Problem**: The eustatic curve selector currently lives in `WellSettings.tsx`. Per user decision,
it should only appear in the Models settings panel, not in well settings.

**Context**: Items BF4-007 and BF4-008 share the same underlying data (`active_sea_level_curve_id`
on the well / inventory). The curve is still stored on the well; only the UI location changes.

### BF4-008-A: Remove from WellSettings

In `WellSettings.tsx` lines 119–135, remove the entire "Sea level correction" section:
```tsx
<div className="template-panel__section-header">Sea level correction</div>
<div className="sf-row">
  <span>Eustatic curve</span>
  <select ...>...</select>
</div>
```
Remove all associated state and handlers:
`seaLevelCurves`, `setWellActiveSeaLevelCurve`, `activeCurveId`, `isSaving`, `handleSeaLevelChange`.

### BF4-008-B: Add to ModelSettings

In `frontend/src/components/layout/settings/ModelSettings.tsx` (or whichever component renders
when a model node is selected), add a sea level section:

```tsx
<div className="template-panel__section-header">Sea level correction</div>
<div className="sf-row">
  <span>Eustatic curve</span>
  <select value={activeCurveId ?? ''} onChange={(e) => void handleSeaLevelChange(e.target.value)}>
    <option value="">None</option>
    {seaLevelCurves.map((c) => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </select>
</div>
```

- This section appears only when model type = `'total'` (the only implemented model).
- The handler calls `setWellActiveSeaLevelCurve(activeWellId, curveId)` — same backend call,
  different UI location.
- The curve is applied well-wide (architecture does not change for now).

### BF4-008-C: Add sea level display in ZoneSettings

Per user: zones must show which sea level curve is active (read-only, synchronized with the
curve set in Models). Add to `ZoneSettings.tsx`:

```tsx
<div className="sf-row">
  <span>Eustatic curve</span>
  <span>{activeCurveName ?? 'None'}</span>
</div>
```

Where `activeCurveName` is derived from `wellInventories.find(w => w.well_id === wellId)?.active_sea_level_curve_id`
and looked up in `seaLevelCurves`. This is read-only — user must go to Models to change it.

**Affected files**:
- `frontend/src/components/layout/settings/WellSettings.tsx` (remove section)
- `frontend/src/components/layout/settings/ModelSettings.tsx` (add section — read file first, may not exist yet)
- `frontend/src/components/layout/settings/ZoneSettings.tsx` (add read-only display)

---

## BF4-009: Models tree — computed state and active indicator (todo)

**Problem**: Model nodes in `WellDataPanel.tsx` `ModelsRoot` component are plain tree-leaf items
styled only with a CSS highlight class. There is no visual indicator for:
1. Whether the model has been computed (has the necessary data to run)
2. Whether the model is the currently active (displayed) model

**Requirements**:

### Computed state (text style)
- `total` model: computed when the active well has ≥ 1 formation with `depth_md != null`.
  Show normal (non-muted) text.
- All other models (`decompaction`, `airy`, `stepwise`, `thermal`): not yet implemented.
  Show muted text + `"planned"` badge (already the case).
- If no well is active: all models show muted text.

### Active indicator
- In single-well chart mode (current): show a radio-button-style circle indicator next to computed
  models. The circle is filled when that model is the active model type (`viewStore.activeModelType`).
- The `ModelsRoot` component must read `activeModelType` from `viewStore`.
- CSS: add a small circle before the model label:
  ```css
  .tree-leaf__radio {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--dm-fg-muted);
    flex-shrink: 0;
  }
  .tree-leaf__radio--active {
    background: var(--accent);
    border-color: var(--accent);
  }
  ```
- In multi-well mode (future): replace radio with checkbox (square). No implementation needed now.

### ModelsRoot changes
```tsx
// add to ModelsRoot:
const activeModelType = useViewStore((s) => s.activeModelType)
const formations = useWellDataStore((s) => s.formations)  // active well formations
const isComputed = (type: SubsidenceModelType) => type === 'total' && formations.length > 0
```

Each model leaf:
```tsx
<span className={`tree-leaf__radio${activeModelType === model.type ? ' tree-leaf__radio--active' : ''}`} />
```
Show the radio span only for computed models (hide for planned).

**Affected files**:
- `frontend/src/components/layout/WellDataPanel.tsx` (`ModelsRoot` component)
- `frontend/src/styles/data-manager.css` (new radio CSS)

---

## BF4-010: Move top-management buttons to side track toolbar (todo)

**Problem**: Toolbar buttons for zoom presets (1:200, 1:500, 1:1000) and top management
(Add top, Link top, Set age, Set type, Delete top, Delete all tops, Move top) are located in
`ProjectToolbar.tsx` at the top of the application. User wants them in a vertical side panel
adjacent to the well tracks, following the pattern of `SubsidenceToolbar.tsx`.

### What to move
From `ProjectToolbar.tsx` lines ~495–503:
- `ZoomControl` component (1:200, 1:500, 1:1000 presets)
- `Add top`
- `Link top`
- `Set age`
- `Set type`
- `Delete top`
- `Delete all tops`
- `Move top`

### What stays in ProjectToolbar
File operations (Load LAS, Load tops, Load unconformities, Load deviation, Load StratChart, etc.)
and project-level actions (New project, Open project, Save project). These are not track-specific.

### New component: WellTrackSideToolbar
Create `frontend/src/components/layout/WellTrackSideToolbar.tsx`:
- Vertical layout, same CSS pattern as `SubsidenceToolbar` (`subsidence-toolbar` → new `well-toolbar`
  class, or reuse the same class if styling is identical).
- Sections:
  1. **Zoom** — three buttons: 1:200, 1:500, 1:1000 (from `ZoomControl` — reuse or inline)
  2. **Divider**
  3. **Tops** — Add top, Link top, Set age, Set type, Delete top, Delete all tops, Move top
     (same `onClick` handlers as current toolbar; extract or pass as props)
- Disabled states match existing toolbar: `disabled={!well}` for Add top, `disabled={!selectedFormation}`
  for the rest.
- Dialog state (`activeDialog`, etc.) should be lifted to the parent or shared via a store if
  currently local to `ProjectToolbar`.

### Placement
Render `WellTrackSideToolbar` to the right of the last track (or as a thin panel to the left/right
of the well track container). Confirm with user if positioning is unclear.

### Duplication check
- "Set type" dialog allows selecting `strat` vs `unconformity` — same as the "Kind" dropdown in
  `TopPickSettings.tsx`. Redundant. Keep in side toolbar (convenient when a top is selected in the
  track without opening settings), leave the dropdown in settings panel too.
- "Set age" opens a prompt dialog — not duplicated elsewhere. Keep.
- "Move top" opens a prompt dialog — redundant with depth input in `TopPickSettings.tsx`. Can remove
  from toolbar or keep for convenience; note the redundancy in code comments.

**Affected files**:
- `frontend/src/components/layout/ProjectToolbar.tsx` (remove moved buttons)
- `frontend/src/components/layout/WellTrackSideToolbar.tsx` (new file)
- Parent layout component that renders the well track area (add `WellTrackSideToolbar` to layout)

---

## BF4-011: Backend API audit — frontend coverage (todo)

**Goal**: Review all backend API endpoints and identify which ones have corresponding frontend UI
actions, which are accessible only via the backend CLI, and which may be dead code. Produce a
reference table in the contract update.

**Scope**: All `@router` route declarations in `app/src/subsidence/api/`.

**Audit method**:
1. List all routes (method + path) from each API file.
2. For each route, search `frontend/src/` for a `fetch` call or store action that calls it.
3. Mark as: `ui` (has a frontend button/action), `cli-only` (CLI only), `unreachable` (no caller).

**Files to audit**:
- `app/src/subsidence/api/wells.py`
- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/sea_level.py`
- `app/src/subsidence/api/strat_charts.py`
- `app/src/subsidence/api/lithology_sets.py`
- `app/src/subsidence/api/lithology_patterns.py`
- `app/src/subsidence/api/compaction_presets.py`
- `app/src/subsidence/api/curve_mnemonics.py`
- `app/src/subsidence/api/measurement_units.py`
- `app/src/subsidence/api/zones.py`
- `app/src/subsidence/api/top_sets.py`

**Deliverable**: Update this section with a table of all endpoints + coverage status after audit.

---

---

## BF4-012: Sea level curve — same depth scale as burial data (todo)

**Problem**: On the single-well subsidence chart, the sea level line currently uses a **secondary
independent Y axis** (right side, teal, `SEA_LEVEL_AXIS_EXTRA = 70 px` of extra right padding).
This double scale is misleading. The user wants the sea level curve plotted on the **same depth
scale** as the burial depth axis.

**Current implementation** in `SubsidenceCanvas.tsx`:
- `SEA_LEVEL_AXIS_EXTRA = 70` — extra right padding when sea level is shown
- `SeaLevelAxisData.slToY` — independent linear mapping from `[minSL, maxSL]` to plot height
- `drawSeaLevelAxis()` — draws the right teal axis with its own tick marks and rotated "Sea level (m)" label
- `pad` computed with extra right padding when `showSeaLevel` is true

**Required changes** (all in `SubsidenceCanvas.tsx`):

1. **Delete** the `SEA_LEVEL_AXIS_EXTRA` constant.
2. **Delete** the `SeaLevelAxisData` interface.
3. **Delete** the `drawSeaLevelAxis()` function entirely.
4. **Simplify** sea level data in `draw`: replace the entire `slData` computation with a single
   sorted-points array:
   ```tsx
   const slPoints = showSeaLevel && seaLevelPoints.length > 0
     ? [...seaLevelPoints]
         .filter((p) => p.age_ma >= 0 && p.age_ma <= maxAge)
         .sort((a, b) => a.age_ma - b.age_ma)
     : []
   ```
5. **Remove** the dynamic `pad` computation — `pad` is always `PADDING_BASE` regardless of `showSeaLevel`.
6. **Update** `paddingRightRef.current` — always `PADDING_BASE.right` (remove the conditional).
7. **Update** `paddingRight` variable used for `GeologicalTimescale` — always `PADDING_BASE.right`.
8. **Draw sea level line** using `depthToY(pt.sea_level_m)` directly (sea level in meters maps
   naturally to the depth axis):
   ```tsx
   if (slPoints.length > 0) {
     ctx.strokeStyle = '#0891b2'
     ctx.lineWidth = 1.5
     ctx.setLineDash([4, 3])
     ctx.beginPath()
     let started = false
     for (const pt of slPoints) {
       const x = timeToX(pt.age_ma)
       const y = depthToY(pt.sea_level_m)
       if (!started) { ctx.moveTo(x, y); started = true }
       else ctx.lineTo(x, y)
     }
     ctx.stroke()
     ctx.setLineDash([])
   }
   ```
9. Remove the `drawSeaLevelAxis(ctx, slData, width, height, pad)` call.

**Note**: Sea level values (m) and burial depth (m) share units so the same `depthToY` mapping is
correct. Typical Haq-style curves span ±200 m, so the sea level line will appear near the top of
the chart — this is geologically correct and expected.

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`

---

## BF4-013: Use marker names (not zone names) on burial chart labels (todo)

**Problem**: In `SubsidenceCanvas.tsx` `drawFormationLabels()` (line 129), labels are drawn as
`curve.formation_name`. When subsidence is computed using zone intervals, the name can be a
combined string like `"Permian -> Jurassic"` — too long to display legibly as a chart annotation.
The user wants the **upper marker name** only (e.g., just `"Permian"`).

**Where the name comes from** (backend):
- `backstrip.py` line 196: `formation_name=f.name` where `f` is `FormationInput` or `ZoneLayerInput`.
- For `FormationInput`, `f.name` is a formation top pick name (already short).
- For `ZoneLayerInput`, `f.name` could be a zone description combining two horizon names.

**Fix** in `drawFormationLabels()` in `SubsidenceCanvas.tsx`:
```tsx
function displayLabel(fullName: string): string {
  const arrowIdx = fullName.indexOf(' -> ')
  const name = arrowIdx !== -1 ? fullName.slice(0, arrowIdx) : fullName
  return name.length > 18 ? name.slice(0, 17) + '…' : name
}
```
Use `displayLabel(curve.formation_name)` instead of `curve.formation_name` at line 129.

This:
- Strips everything after ` -> ` (keeps only the upper/older horizon name).
- Truncates names longer than 18 characters with `…` as a safety net.

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx` (`drawFormationLabels` function)

---

## BF4-014: Horizontal km gridlines on single-well subsidence chart (todo)

**Requirement**: Draw very thin horizontal gridlines behind the chart content at exact whole-km
depth values: 0 km, 1 km, 2 km, 3 km … (i.e., 0 m, 1000 m, 2000 m, 3000 m, …).

**Appearance**:
- `lineWidth = 0.5`
- `strokeStyle = 'rgba(148, 163, 184, 0.3)'` — very faint slate blue (barely visible background)
- Full plot width (from left edge `pad.left` to right edge `pad.left + plotW`)
- No labels (depth axis tick marks already annotate the same depths)

**Placement in draw order**: inside the `ctx.save() / ctx.clip()` block, **before**
`drawFormationFills` and `drawBurialCurves`, so gridlines appear behind all data.

**Implementation** — add a `drawKmGridlines` function:
```tsx
function drawKmGridlines(
  ctx: CanvasRenderingContext2D,
  plotLeft: number,
  plotWidth: number,
  minDepthM: number,
  maxDepthM: number,
  depthToY: (d: number) => number,
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
  ctx.lineWidth = 0.5
  const firstKm = Math.ceil(minDepthM / 1000) * 1000
  for (let d = firstKm; d <= maxDepthM; d += 1000) {
    const y = depthToY(d)
    ctx.beginPath()
    ctx.moveTo(plotLeft, y)
    ctx.lineTo(plotLeft + plotWidth, y)
    ctx.stroke()
  }
  ctx.restore()
}
```

Call it in the `draw` callback inside the clip region:
```tsx
ctx.save()
ctx.beginPath()
ctx.rect(pad.left, pad.top, plotW, plotH)
ctx.clip()

drawKmGridlines(ctx, pad.left, plotW, effectiveMinDepthM, effectiveMaxDepthM, depthToY)  // ← new, first
if (showFormationFills) drawFormationFills(...)
if (showBurialCurves)   drawBurialCurves(...)
// ... sea level line ...

ctx.restore()
```

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`

---

## BF4-016: Simplified LAS/CSV import — options on preview step, direct Load (todo)

**Summary**: The LAS and CSV log import dialogs have too many wizard steps. Both should collapse to
two steps: File → Preview (with options inline) + Load button. The separate Options and
Import/Summary steps are removed. Additionally, the duplicate Close/Cancel buttons should be
resolved.

---

### BF4-016-A: Collapse LAS wizard to 2 steps

**Current**: File(0) → Preview(1) → Options(2) → Import/Summary(3)
**New**: File(0) → Preview+Options(1)

In `ImportLasDialog.tsx`:
- Replace step labels: use `['File', 'Preview']` for LAS instead of `DEFAULT_STEP_LABELS`
- Remove `optionsStep` and `summaryStep` variables
- Remove the `{currentStepIndex === optionsStep ? ...}` and `{currentStepIndex === summaryStep ? ...}` blocks
- Move Target well fields + Depth reference dropdown into the Preview step, rendered below `<LasPreviewPane>`:

```tsx
{currentStepIndex === 1 ? (
  <>
    <LasPreviewPane isLoading={previewLoading} error={previewError} preview={lasPreview} />

    {!previewLoading && (lasPreview !== null || previewError !== null) && (
      <div className="import-wizard__options">
        <ImportWizardTargetWellFields
          wells={wells}
          wellId={wellId}
          createNewWell={createNewWell}
          emptyLabel="Create or match by LAS well name"
          fileWellSource={fileWellSource}
          wellPolicy={wellPolicy}
          onWellIdChange={setWellId}
          onCreateNewWellChange={setCreateNewWell}
          onWellPolicyChange={setWellPolicy}
        />
        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD — measured depth</option>
            <option value="TVD">TVD — true vertical depth</option>
            <option value="TVDSS">TVDSS — TVD subsea</option>
          </select>
        </label>
      </div>
    )}
  </>
) : null}
```

Step 1 is now the final step → `ImportWizardShell` renders Cancel / Back / Load (submit) automatically.
`canSubmit`: `sourceIsValid && previewReady`.

---

### BF4-016-B: Auto-detect LAS depth reference from curve mnemonic

LAS files always place the depth curve first in the curve list (`lasPreview.curves[0]`).
Auto-populate `trustedDepthRef` when the preview loads:

```tsx
function detectLasDepthRef(mnemonic: string): 'MD' | 'TVD' | 'TVDSS' {
  const m = mnemonic.toUpperCase().trim()
  if (m.startsWith('TVDSS')) return 'TVDSS'
  if (m.startsWith('TVD')) return 'TVD'
  return 'MD'   // DEPT, DEPTH, MD, MEASURED_DEPTH, etc.
}

useEffect(() => {
  if (lasPreview?.curves.length) {
    setTrustedDepthRef(detectLasDepthRef(lasPreview.curves[0].mnemonic))
  }
}, [lasPreview])
```

Dropdown stays editable — auto-detect is just a pre-fill.

---

### BF4-016-C: Auto-match LAS well name to existing project wells

When `lasPreview` loads with a `well_name`, try a case-insensitive name match against the `wells`
list. If a match is found, auto-select it in the dropdown (`wellPolicy='override'`). If no match,
fall back to `wellPolicy='file'` (backend will use the LAS name to create or match).

```tsx
useEffect(() => {
  if (!lasPreview?.well_name) return
  const normalized = lasPreview.well_name.trim().toLowerCase()
  const match = wells.find((w) => w.well_name.trim().toLowerCase() === normalized)
  if (match) {
    setWellId(match.well_id)
    setWellPolicy('override')
  } else {
    setWellId('')
    setWellPolicy('file')
  }
}, [lasPreview, wells])
```

**Remove** the existing `useEffect(() => { setWellPolicy(fileWellSource ? 'file' : 'override') }, [fileWellSource])` —
BF4-016-C replaces it.

---

### BF4-016-D: Collapse CSV wizard to 2 steps — remove Mapping step entirely

**Current**: File(0) → Preview(1) → Mapping(2) → Options(3) → Import(4)
**New**: File(0) → Preview+Options(1)

In `ImportLasDialog.tsx`:
- Use `['File', 'Preview']` as step labels for CSV too; remove usage of `MAPPING_STEP_LABELS`
- Remove `{currentStepIndex === 2 && sourceType === 'csv' ? <MappingPane ...> : null}` block
- Remove `mappingErrors` / `mappingOk` variables (no longer used for step gating; still needed for `canSubmit`)
- The depth column is taken directly from `mapping['depth']` (already auto-mapped by the existing `useEffect`)

New step 1 for CSV:
```tsx
{currentStepIndex === 1 && sourceType === 'csv' ? (
  <>
    <TabularPreviewPane
      isLoading={previewLoading}
      error={previewError}
      preview={tabularPreview}
      settings={parserSettings}
      onSettingsChange={updateParserSettings}
      depthColumn={mapping['depth'] ?? null}
    />

    {!previewLoading && tabularPreview && (
      <div className="import-wizard__options">
        <ImportWizardTargetWellFields
          wells={wells}
          wellId={wellId}
          createNewWell={createNewWell}
          emptyLabel="Select target well"
          onWellIdChange={setWellId}
          onCreateNewWellChange={setCreateNewWell}
        />
        <div className="project-dialog__field">
          <span>Depth column</span>
          <span>{mapping['depth'] ?? <em>not detected</em>}</span>
        </div>
        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD — measured depth</option>
            <option value="TVD">TVD — true vertical depth</option>
            <option value="TVDSS">TVDSS — TVD subsea</option>
          </select>
        </label>
      </div>
    )}

    {!previewLoading && tabularPreview && !mapping['depth'] && (
      <p className="project-dialog__error">
        No depth column detected. Rename a column to DEPT, DEPTH, MD, TVD, or TVDSS and reload.
      </p>
    )}
  </>
) : null}
```

`canSubmit` for CSV: `sourceIsValid && tabularPreview !== null && !!mapping['depth']`

---

### BF4-016-E: Auto-detect CSV depth reference from column name

When `mapping['depth']` changes after auto-mapping, infer `trustedDepthRef`:

```tsx
function detectCsvDepthRef(columnName: string): 'MD' | 'TVD' | 'TVDSS' {
  const c = columnName.toLowerCase().replace(/[_\s-]/g, '')
  if (c.includes('tvdss')) return 'TVDSS'
  if (c.includes('tvd')) return 'TVD'
  return 'MD'
}

useEffect(() => {
  const col = mapping['depth']
  if (col) setTrustedDepthRef(detectCsvDepthRef(col))
}, [mapping])
```

---

### BF4-016-F: Highlight depth column in CSV preview table

Add `depthColumn?: string | null` prop to `TabularPreviewPane`.
Mark the matched column's header and body cells with a CSS class:

```tsx
// TabularPreviewPane.tsx — inside the table render:
const depthColIndex = depthColumn != null ? preview.columns.indexOf(depthColumn) : -1

// <th>:
<th key={i} className={i === depthColIndex ? 'import-preview__col--depth' : undefined}>

// <td>:
<td key={ci} className={ci === depthColIndex ? 'import-preview__col--depth' : undefined}>
```

CSS (wherever `.import-preview__table` is styled):
```css
.import-preview__col--depth {
  background: rgba(186, 230, 253, 0.35);   /* very faint sky-blue */
}
```

---

### BF4-016-G: Remove Close / Cancel duplication

The dialog header in `ImportWizardShell.tsx` has a "Close" link (`project-dialog__link`) and the
footer already has a "Cancel" button — both call `onClose`. Remove the header "Close" button:

```tsx
// Remove from ImportWizardShell.tsx header:
<button type="button" className="project-dialog__link" onClick={onClose}>
  Close
</button>
```

`ImportWizardShell` is shared by tops, deviation, unconformities, and strat-chart dialogs —
the removal affects all of them. None have special logic in the header close; the footer Cancel
is sufficient.

**Affected files**:
- `frontend/src/components/layout/ImportLasDialog.tsx` (sub-items A–E)
- `frontend/src/components/layout/importWizard/TabularPreviewPane.tsx` (sub-item F)
- `frontend/src/components/layout/importWizard/ImportWizardShell.tsx` (sub-item G)
- CSS file where `.import-preview__table` styles live (sub-item F)

**Complexity**: S — frontend only, no backend changes. All sub-items are independent.

---

## BF4-015: Track resize — narrowing only updates header, not canvas (todo)

**Problem**: When dragging the right edge of a track to the **right** (widening), the track header
and canvas both update correctly. When dragging **left** (narrowing) — including reversing direction
mid-drag — the header shrinks but the canvas content stays at its original width.

**Repro steps**:
1. Open a project with one or more log tracks.
2. Drag the right edge of a track to the right — both header and canvas widen correctly.
3. In the same drag (or a new drag), pull the edge to the left — the header collapses but the
   canvas (curve data, depth scale, formation column) does not follow.

**Root cause** (confirmed hypothesis):

Canvas elements inside a flex row have `min-width: auto` by default. When a canvas is used for
HiDPI rendering, `useCanvasRenderer.ts` sets `canvas.width = Math.round(clientWidth * devicePixelRatio)`.
This raises the *intrinsic* HTML canvas bitmap width (e.g., 300 px becomes 600 px at 2× DPR).

In a flex container, `min-width: auto` evaluates to the element's *intrinsic content size*. After
`canvas.width` is raised by the HiDPI write, the intrinsic size is now the bitmap pixel width
(interpreted in CSS px). Even though `style.width = '150px'` is set by the parent, the flex engine
refuses to shrink the element below its intrinsic minimum. The header (`<button>` elements) has a
small intrinsic size (text content) and therefore *does* shrink, which creates the split behaviour.

**Fix** — add `min-width: 0` to every canvas-wrapper in the track row:

In `frontend/src/styles/log-view.css`:
```css
.data-track,
.formation-column,
.depth-track {
  min-width: 0;    /* allow flex container to shrink canvas below intrinsic width */
}
```

`min-width: 0` is the standard fix for this well-known flex-container / canvas intrinsic-size
problem. Setting it to `0` does **not** change any visible behaviour when the track width is
increasing — it only removes the hidden lower bound that prevents shrinking.

**Affected files**:
- `frontend/src/styles/log-view.css`

**Complexity**: XS — single CSS rule addition, no JS changes.

**Verification**: After the fix, drag a track right edge left; the canvas should collapse in
lockstep with the header. Check at both 1× and 2× devicePixelRatio (browser zoom 100% and 200%).

---

## Implementation order

| # | Item | Complexity | Notes |
|---|---|---|---|
| 1 | BF4-015 | XS | One CSS rule — highest priority, visible defect |
| 2 | BF4-001 | XS | SVG overflow fix, 1–2 lines |
| 3 | BF4-002 | XS | Remove span elements |
| 4 | BF4-006 | XS | Remove hex input, update CSS for oval |
| 5 | BF4-007-A | XS | CSS padding on select |
| 6 | BF4-012 | XS | Remove sea level dual axis in SubsidenceCanvas |
| 7 | BF4-013 | XS | Display label fix in drawFormationLabels |
| 8 | BF4-014 | XS | Add km gridlines in draw callback |
| 9 | BF4-003 | S | StratCharts hierarchy restructure |
| 10 | BF4-008 | S | Move sea level selector to Models |
| 11 | BF4-009 | S | Models computed state + radio |
| 12 | BF4-004 | S | Curve settings when disabled (investigate first) |
| 13 | BF4-016 | S | Simplified LAS/CSV import dialog (frontend only) |
| 14 | BF4-010 | M | New side toolbar component |
| 15 | BF4-007-B | M | Sea level override per top (backend + frontend) |
| 16 | BF4-011 | M | API audit (research task) |
| 17 | BF4-005 | L | Lithology discrete/fraction (multi-step) |
