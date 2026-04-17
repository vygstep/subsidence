# Phase 3: Interactivity — Formation Tops, Cursors, and Property Panels

**Goal**: Wire the persistence layer built in Phase 2.5 to the visible UI. Users can open and
create projects through dialogs, drag formation top lines, inspect curve values at the cursor
depth, edit curve and formation properties in a panel, and manage formations through a sidebar.
The Canvas tracks remain read-only renderers; all interaction is handled by an SVG overlay and
React panels communicating through Zustand stores and the Phase 2.5 REST API.

**Status**: In progress.

---

## Progress

| Step | Status | Verification | Commit |
|---|---|---|---|
| Step 1  | done | `PATCH /api/projects/visual-config` persists `trackWidths`, `depthPerPixel`, and `curveColors`; close + reopen preserves visual config; export LAS/CSV endpoints return valid files | `fcf9248` |
| Step 2  | pending | New Project dialog creates bundle; Open dialog restores last-saved state | — |
| Step 3  | pending | `POST /api/projects/wells/{id}/formations` → line appears in FormationColumn | — |
| Step 4  | pending | formation lines render at correct depths and move with scroll; crosshair tracks mouse | — |
| Step 5  | pending | drag top 50 m → depth commits; Ctrl+Z reverts in one undo step | — |
| Step 6  | pending | StatusBar shows MD at cursor; tooltip shows interpolated GR / ILD values | — |
| Step 7  | pending | click near GR line → glow highlight; click elsewhere → deselects | — |
| Step 8  | pending | change curve color in PropertyPanel → track re-renders; close/reopen persists | — |
| Step 9  | pending | add formation via sidebar → overlay line appears; delete → line disappears | — |
| Step 10 | pending | drag minimap viewport rect → main view scrolls; switch wells → tracks update | — |

---

## Task Checklist

### Step 1 - Visual config persistence and export integration
- [x] 1.1 Add canonical visual-config endpoints to `app/src/subsidence/api/projects.py`:
          `GET /api/projects/visual-config` and `PATCH /api/projects/visual-config`
- [x] 1.2 Keep working export endpoints:
          `POST /api/projects/export/las` and `POST /api/projects/export/csv`
          Both must return valid files generated from project data; no frontend export UI yet
- [x] 1.3 Add `visualConfig`, `loadVisualConfig()`, and `saveVisualConfig(patch)`
          to `src/stores/projectStore.ts`
- [x] 1.4 When a project becomes active, load visual config and hydrate:
          `viewStore.trackWidths`, `viewStore.depthPerPixel`, and curve color overrides
- [x] 1.5 After track-width or depth-scale changes, debounce-flush
          `saveVisualConfig(...)` (500 ms)
- [x] 1.6 Verify: resize a track -> close project -> reopen -> width preserved;
          change zoom -> close project -> reopen -> scale preserved;
          if a curve color override exists in visual config, it is restored on reopen


### Step 2 — Project selector UI
- [ ] 2.1 Write `src/components/layout/NewProjectDialog.tsx`: name + path `<input>` fields, calls `POST /api/projects` then `POST /api/projects/open`
- [ ] 2.2 Write `src/components/layout/FileOpenDialog.tsx`: path `<input>`, "Recent projects" list from `GET /api/projects/recent`, calls `POST /api/projects/open`
- [ ] 2.3 In `App.tsx`, show `FileOpenDialog` when `projectStore.isOpen === false` (replaces raw path wiring from Phase 2.5)
- [ ] 2.4 Add `GET /api/projects/recent` backend endpoint returning the last 10 opened project paths (stored in a `recent_projects.json` next to the session dir)
- [ ] 2.5 Verify: enter a valid `.subsidence` path in the dialog → project opens; title bar shows `project_name`; invalid path shows inline error

### Step 3 — Formation tops API + store CRUD
- [ ] 3.1 Write `app/src/subsidence/api/formations.py` with five endpoints (see spec)
- [ ] 3.2 Register formations router in `app/src/subsidence/api/main.py` under `/api/projects/wells/{well_id}/formations`
- [ ] 3.3 On `wellDataStore.loadWell(id)`, also fetch `GET .../formations` and populate `wellDataStore.formations`
- [ ] 3.4 Wire `wellDataStore.addFormation` → `POST .../formations` + `ImportFormation` undo command
- [ ] 3.5 Wire `wellDataStore.updateFormationDepth(id, depth)` → `PATCH .../formations/{id}` + `UpdateFormationDepth` undo command
- [ ] 3.6 Wire `wellDataStore.removeFormation(id)` → `DELETE .../formations/{id}` + `RemoveFormation` undo command
- [ ] 3.7 Verify: after `import_tops_csv`, `GET .../formations` returns 32 rows; `PATCH` a depth → `GET` reflects new value; `DELETE` → row absent

### Step 4 — InteractionOverlay + static FormationTopLine + DepthCursor
- [ ] 4.1 Install frontend dependency: `@visx/drag`
- [ ] 4.2 Write `src/components/interaction/InteractionOverlay.tsx`: absolute `<svg>` over track area, `pointer-events: none` on root, children receive `pointer-events: auto` individually
- [ ] 4.3 Write `src/components/interaction/FormationTopLine.tsx`: `<g>` with dashed `<line>` spanning `totalWidth`, `<text>` label left-anchored, formation color, lock icon if `is_locked` (static — no drag yet)
- [ ] 4.4 Write `src/components/interaction/DepthCursor.tsx`: `<line>` at `viewStore.cursorDepth` pixel-y; updates via `onMouseMove` forwarded from `InteractionOverlay`
- [ ] 4.5 Export from `src/components/interaction/index.ts`
- [ ] 4.6 Add `InteractionOverlay` to `LogViewPanel.tsx`: positioned `absolute`, same width/height as the scrollable track area, fed `formations` + `depthScale` + `totalWidth`
- [ ] 4.7 Verify: project with imported tops → formation lines appear at correct depths; scroll → lines move in sync; mouse → crosshair follows

### Step 5 — Formation top drag + undo
- [ ] 5.1 Write `src/hooks/useFormationDrag.ts`: pointer-capture on `pointerdown`, throttled pixel→depth conversion at 60 fps, commit to store on `pointerup` (see spec)
- [ ] 5.2 Update `FormationTopLine.tsx`: attach `useFormationDrag`, show `cursor: ns-resize`; skip drag if `formation.is_locked`
- [ ] 5.3 Ensure `wellDataStore.updateFormationDepth` pushes `UpdateFormationDepth` to the undo stack before the debounced PATCH (300 ms)
- [ ] 5.4 Verify: drag top 50 m → depth in store + StatusBar + FormationColumn all show new value; Ctrl+Z → depth reverts to original

### Step 6 — DepthCursor readout + CurveTooltip + StatusBar
- [ ] 6.1 Write `src/components/layout/StatusBar.tsx`: bottom strip, shows `MD {depth} m` from `viewStore.cursorDepth`; placeholder slots for computation status and dirty indicator (moved from title bar)
- [ ] 6.2 Write `src/components/interaction/CurveTooltip.tsx`: HTML `<div>` (not SVG) absolutely positioned at cursor, shows interpolated values for every visible curve at `cursorDepth` using binary search + linear interpolation on `Float32Array`
- [ ] 6.3 Update `InteractionOverlay` to forward `onMouseMove` to `viewStore.setCursorDepth` and pass the pixel position to `CurveTooltip`
- [ ] 6.4 Add `StatusBar` to `App.tsx` at the bottom of the layout grid
- [ ] 6.5 Verify: mouse at depth 2500 m → StatusBar reads `MD 2500.0 m`; tooltip shows GR, ILD, RHOB values at that depth; tooltip disappears on `mouseleave`

### Step 7 — Curve click-to-select + highlight rendering
- [ ] 7.1 Extend `viewStore.ts` with `selectedElementId: string | null`, `selectedElementType: 'curve' | 'track' | 'formation' | null`, `selectElement(id, type)`, `clearSelection()`
- [ ] 7.2 Add `onClick` to `DataTrack.tsx`: compute canvas-x of each curve at cursor depth, select the curve whose pixel-x is nearest to click-x within ±5 px tolerance; fire `viewStore.selectElement(mnemonic, 'curve')`
- [ ] 7.3 Update `curveRenderer.ts` — `drawCurve` gains optional `isSelected: boolean`; when `true`, draw with `lineWidth × 2` and `ctx.shadowBlur = 8` in a lighter variant of the curve color
- [ ] 7.4 Update `TrackHeader.tsx`: click → `viewStore.selectElement(trackId, 'track')`; add `outline: 2px solid #3b82f6` when selected
- [ ] 7.5 Update `InteractionOverlay.tsx`: `onClick` on SVG background (not on a child) → `viewStore.clearSelection()`
- [ ] 7.6 Add global `keydown` handler in `App.tsx`: `Escape` → `viewStore.clearSelection()`
- [ ] 7.7 Verify: click GR curve → glow highlight; click track header → blue border; click elsewhere → deselects; Escape → deselects

### Step 8 — PropertyPanel
- [ ] 8.1 Write `src/components/sidebar/PropertyPanel.tsx`: reads `viewStore.selectedElementId/Type`; renders the appropriate editor section (see spec)
- [ ] 8.2 Formation editor fields: name `<input>`, depth MD `<input type="number">`, color `<input type="color">`, lithology `<select>` from `LithologyType`, lock checkbox
- [ ] 8.3 Curve editor fields: color `<input type="color">`, lineWidth slider (1–3 px step 0.5), scaleMin + scaleMax `<input type="number">`, lineStyle radio group, scale type toggle (linear / log)
- [ ] 8.4 Track editor fields: title `<input>`, show-grid checkbox, gridDivisions `<input type="number">`
- [ ] 8.5 Each change: optimistic update in store → debounced (300 ms) `PATCH` appropriate endpoint → push `UpdateVisualConfig` to undo stack
- [ ] 8.6 Add PropertyPanel to `MainLayout.tsx` right column (220 px, collapsible via toggle button)
- [ ] 8.7 Verify: select a curve → PropertyPanel shows current color; change color → track redraws; close + reopen → color persists

### Step 9 — FormationTopsList sidebar + CurveBrowser
- [ ] 9.1 Write `src/components/sidebar/FormationTopsList.tsx`: scrollable list of all `wellDataStore.formations`, sorted by depth; each row shows depth, color swatch, name, lock icon, delete button
- [ ] 9.2 Add "＋ Add formation" button: creates a new top at `viewStore.cursorDepth ?? midDepth` via `wellDataStore.addFormation`; new row highlighted and scrolled into view
- [ ] 9.3 Row click → `viewStore.selectElement(id, 'formation')` + `viewStore.setScroll(depth - halfViewport)` (scroll to center formation in view)
- [ ] 9.4 Lock/unlock toggle → `wellDataStore.updateFormation(id, { is_locked: !current })` → `PATCH`
- [ ] 9.5 Write `src/components/sidebar/CurveBrowser.tsx`: lists all curves available from `wellDataStore.well.curves` not yet in the selected track; click adds curve to selected track with default `CurveConfig`; grays out curves already shown
- [ ] 9.6 Export from `src/components/sidebar/index.ts`
- [ ] 9.7 Add left sidebar to `MainLayout.tsx` (200 px, collapsible): top half `FormationTopsList`, bottom half `CurveBrowser`
- [ ] 9.8 Verify: add top via sidebar → overlay line appears; delete → disappears; click row → view centers on formation depth

### Step 10 — WellOverviewMinimap + well selector
- [ ] 10.1 Write `src/components/logview/WellOverviewMinimap.tsx`: small Canvas (80 × full-height sidebar), renders all visible curves as 1 px lines at full-well depth range; draws a blue translucent viewport rect indicating current scroll position (see spec)
- [ ] 10.2 Click or drag on minimap → `viewStore.setScroll(mappedDepth)`
- [ ] 10.3 Add `GET /api/projects/wells` backend endpoint listing `{ id, name, td_md }` for all wells in the project
- [ ] 10.4 Add well-selector `<select>` in `AppHeader.tsx` populated from `GET /api/projects/wells`; on change call `wellDataStore.loadWell(newId)`
- [ ] 10.5 Add `WellOverviewMinimap` to `LogViewPanel.tsx` anchored to the right edge of the track area
- [ ] 10.6 Verify: drag minimap viewport rect → main view scrolls to matching depth; import a second well → well selector lists both; switch → all tracks show new well's curves

---

## Detailed step specifications

### Step 1 ? Visual config persistence and export integration

Status: done
Verification: `PATCH /api/projects/visual-config` persists `trackWidths`, `depthPerPixel`, and `curveColors`; backend compile passes; frontend build passes; close ? reopen preserves visual config; export LAS/CSV endpoints return valid files
Commit: `fcf9248`

**Backend additions to `app/src/subsidence/api/projects.py`:**

- Added canonical visual-config endpoints:
  - `GET /api/projects/visual-config`
  - `PATCH /api/projects/visual-config`
- Kept working export endpoints:
  - `POST /api/projects/export/las`
  - `POST /api/projects/export/csv`
- `PATCH /api/projects/visual-config` performs a merge update against the existing project config and writes through `UpdateVisualConfig`.

**Frontend updates:**

- `src/stores/projectStore.ts` now owns `visualConfig`, `loadVisualConfig()`, and `saveVisualConfig(patch)`.
- `src/stores/wellDataStore.ts` now exposes `colorOverrides` for curve-level visual overrides.
- `App.tsx` hydrates visual config when a project becomes active and debounce-saves visual changes through `projectStore.saveVisualConfig(...)`.

**Hydrated keys in Step 1:**

- `trackWidths`
- `depthPerPixel`
- `curveColors`

**Acceptance criteria:** Track widths, zoom level, and stored curve color overrides survive a close/reopen cycle; LAS and CSV export endpoints return valid files generated from project data.

---

### Step 2 — Project selector UI

Status: pending
Verification: enter valid project path → title bar shows project name; invalid path shows inline error
Commit: —

**`src/components/layout/NewProjectDialog.tsx`:**

```ts
interface NewProjectDialogProps {
  onClose: () => void;
}
```

Form fields: `Project name` (text), `Location` (text, full path to parent directory). On submit: `POST /api/projects { name, parent_dir }` then `POST /api/projects/open { path: result.path }` then `projectStore.loadVisualConfig()` → close dialog.

**`src/components/layout/FileOpenDialog.tsx`:**

```ts
interface FileOpenDialogProps {
  onClose: () => void;
}
```

Shows `Recent projects` list (from `GET /api/projects/recent`) plus a manual path input. Clicking a recent project pre-fills the path field. On submit: `POST /api/projects/open { path }` → `wellDataStore.loadWell(first_well_id)` → close dialog.

**Backend `GET /api/projects/recent`:** reads `recent_projects.json` from `<platformdirs.user_data_dir>/subsidence/` — a JSON array of `{ name, path, last_opened }` objects kept sorted newest-first, capped at 10.

**`App.tsx` gate:** if `!projectStore.isOpen`, render `<FileOpenDialog>` centered over a dark overlay. A "New project" link in the dialog header switches to `<NewProjectDialog>`.

**Acceptance criteria:** Cold start with no open project → dialog shown; creating a new project via dialog makes a `.subsidence/` bundle on disk; opening an existing one loads its data.

---

### Step 3 — Formation tops API + store CRUD

Status: pending
Verification: PATCH depth → GET reflects new value; DELETE → row absent; undo reverts delete
Commit: —

**`app/src/subsidence/api/formations.py`:**

```python
@router.get("/{well_id}/formations")
async def list_formations(well_id: str, ...) -> list[FormationTopResponse]: ...

@router.post("/{well_id}/formations", status_code=201)
async def create_formation(well_id: str, body: FormationTopCreate, ...) -> FormationTopResponse: ...

@router.patch("/{well_id}/formations/{formation_id}")
async def update_formation(well_id: str, formation_id: str, body: FormationTopPatch, ...) -> FormationTopResponse: ...

@router.delete("/{well_id}/formations/{formation_id}", status_code=204)
async def delete_formation(well_id: str, formation_id: str, ...) -> None: ...
```

Pydantic models:

```python
class FormationTopCreate(BaseModel):
    name: str
    depth_md: float
    color: str = '#808080'
    lithology: str | None = None
    age_ma: float | None = None
    is_locked: bool = False

class FormationTopPatch(BaseModel):
    name: str | None = None
    depth_md: float | None = None
    color: str | None = None
    lithology: str | None = None
    age_ma: float | None = None
    is_locked: bool | None = None

class FormationTopResponse(BaseModel):
    id: str
    name: str
    depth_md: float
    color: str
    lithology: str | None
    age_ma: float | None
    is_locked: bool
```

Each mutating endpoint wraps the ORM write in the `UndoStack` via the appropriate command class. Add `RemoveFormation` command to `app/src/subsidence/data/undo.py`:

```python
class RemoveFormation(Command):
    def apply(self, session):   session.delete(session.get(FormationTopModel, self.id))
    def revert(self, session):  session.add(FormationTopModel(**self._snapshot))
    @property
    def description(self): return f"Delete formation {self._name!r}"
```

**Frontend wiring in `src/stores/wellDataStore.ts`:**

```ts
addFormation: async (top: Omit<FormationTop, 'id'>) => {
  const res = await fetch(`/api/projects/wells/${wellId}/formations`, { method: 'POST', body: JSON.stringify(top) });
  const created: FormationTop = await res.json();
  set(s => ({ formations: [...s.formations, created].sort((a,b) => a.depth_md - b.depth_md) }));
}
updateFormationDepth: async (id: string, depth: number) => {
  // optimistic update first
  set(s => ({ formations: s.formations.map(f => f.id === id ? { ...f, depth_md: depth } : f) }));
  await debouncedPatch(id, { depth_md: depth });   // 300 ms debounce
}
removeFormation: async (id: string) => {
  await fetch(`/api/projects/wells/${wellId}/formations/${id}`, { method: 'DELETE' });
  set(s => ({ formations: s.formations.filter(f => f.id !== id) }));
}
```

**Acceptance criteria:** All five HTTP endpoints respond correctly; `FormationColumn` renders the DB-loaded tops with correct depths after a reload.

---

### Step 4 — InteractionOverlay + static FormationTopLine + DepthCursor

Status: pending
Verification: formation lines at correct depths; move with scroll; crosshair follows mouse
Commit: —

**`src/components/interaction/InteractionOverlay.tsx`:**

```ts
interface InteractionOverlayProps {
  width: number;            // Sum of all track widths
  height: number;           // Visible track area height in px
  formations: FormationTop[];
  depthToPixel: (d: number) => number;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onClick: (e: React.MouseEvent<SVGSVGElement>) => void;
}
```

Rendered as `<svg style={{ position:'absolute', top:0, left:0, pointerEvents:'none', zIndex:10 }} width={width} height={height}>`. Renders `<FormationTopLine>` for each formation and `<DepthCursor>` when `cursorDepth !== null`.

**`src/components/interaction/FormationTopLine.tsx`:**

```ts
interface FormationTopLineProps {
  formation: FormationTop;
  yPosition: number;          // Computed: depthToPixel(formation.depth_md)
  totalWidth: number;
  // drag callbacks added in Step 5
}
```

Structure: `<g style={{ pointerEvents:'auto' }}>` containing:
- `<line x1={0} x2={totalWidth} y={yPosition}` stroke={formation.color} strokeWidth={1.5} strokeDasharray="6 3" />
- `<rect x={2} y={yPosition-10} …>` + `<text>` label background + label
- Optional lock icon `<LockIcon>` when `is_locked`

**`src/components/interaction/DepthCursor.tsx`:**

```ts
interface DepthCursorProps {
  yPosition: number;     // Pixel Y of cursor in overlay coordinates
  totalWidth: number;
  depth: number;         // For label text
}
```

`<line>` 1 px, `rgba(0,0,0,0.4)`, full width. No label — depth shown in `StatusBar`.

**`LogViewPanel.tsx` update:** compute `totalWidth` = sum of `viewStore.trackWidths` values; place `<InteractionOverlay>` as `position:absolute` child of the track scroll container using a `position:relative` wrapper.

**Acceptance criteria:** All formation lines appear at correct pixel positions relative to current scroll; cursor line follows mouse movement within the track area; SVG does not block wheel events (use `pointerEvents:'none'` on root SVG, auto only on children).

---

### Step 5 — Formation top drag + undo

Status: pending
Verification: drag 50 m → depth updates everywhere; Ctrl+Z reverts in one step
Commit: —

**`src/hooks/useFormationDrag.ts`:**

```ts
interface UseFormationDragOptions {
  formation: FormationTop;
  depthToPixel: (d: number) => number;
  pixelToDepth: (px: number) => number;
  onDepthChange: (depth: number) => void;    // called at 60fps during drag (local state only)
  onDragEnd: (finalDepth: number) => void;   // called on pointerup, commits to store
}

interface UseFormationDragResult {
  isDragging: boolean;
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
}
```

Implementation:
1. `onPointerDown`: `e.currentTarget.setPointerCapture(e.pointerId)`, record `startY` + `startDepth`
2. `onPointerMove` (attached to `window`): compute `dy = e.clientY - startY`, `newDepth = startDepth + dy * (depthPerPixel)`, call `onDepthChange(newDepth)`
3. `onPointerUp`: call `onDragEnd(newDepth)`, release pointer capture
4. Clamp depth to `[minDepth, maxDepth]` from `viewStore`

**`FormationTopLine.tsx` drag integration:**

```ts
const { isDragging, dragHandlers } = useFormationDrag({
  formation,
  depthToPixel,
  pixelToDepth,
  onDepthChange: setLocalY,           // React.useState in FormationTopLine
  onDragEnd: wellDataStore.updateFormationDepth.bind(null, formation.id),
});
```

The component maintains a `localY` state for the 60fps visual during drag. On drag end, `wellDataStore.updateFormationDepth` pushes `UpdateFormationDepth` to the undo stack before the debounced PATCH.

Lock check:

```ts
if (formation.is_locked) return;   // dragHandlers spread has no effect
```

Visual during drag: stroke opacity 1.0 (vs 0.75 at rest), cursor `ns-resize`.

**Acceptance criteria:** Drag a top by 50 m → FormationColumn + FormationTopsList + StatusBar all show updated depth; Ctrl+Z → depth reverts in one step; dragging a locked top has no effect and shows a `not-allowed` cursor.

---

### Step 6 — DepthCursor readout + CurveTooltip + StatusBar

Status: pending
Verification: StatusBar reads `MD {depth} m`; tooltip shows interpolated curve values; hides on `mouseleave`
Commit: —

**`src/components/layout/StatusBar.tsx`:**

```ts
// No props — reads from viewStore and projectStore
function StatusBar(): JSX.Element
```

Left slot: `MD {cursorDepth.toFixed(1)} m` (hidden when `cursorDepth === null`).
Center slot: computation status placeholder (`●` = computing, `✓` = up to date).
Right slot: dirty indicator (`●` when `projectStore.isDirty`), project name.

**`src/components/interaction/CurveTooltip.tsx`:**

```ts
interface CurveTooltipProps {
  x: number;               // Client X of mouse in overlay
  y: number;               // Client Y of mouse in overlay
  depth: number;
  curves: CurveData[];     // All visible curves for this well
  visible: boolean;
}
```

Renders as a `<div style={{ position:'fixed', left: x+12, top: y+4, zIndex:50 }}>` with a dark semi-transparent background, one row per curve: `{mnemonic}: {value.toFixed(2)} {unit}`.

Value interpolation:

```ts
function interpolateAtDepth(depths: Float32Array, values: Float32Array, target: number): number | null {
  const idx = bisectLeft(depths, target);
  if (idx === 0 || idx >= depths.length) return null;
  const t = (target - depths[idx-1]) / (depths[idx] - depths[idx-1]);
  return depths[idx-1] + t * (values[idx] - values[idx-1]);
  // (corrected: values[idx-1] + t * ...)
}
```

`InteractionOverlay` passes `clientX/Y + depth` to `CurveTooltip` via lifted state.

**Acceptance criteria:** Mouse at depth 2500 m → StatusBar reads `MD 2500.0 m`; tooltip shows one row per loaded curve with interpolated value; moving mouse off the track area sets `cursorDepth = null` and hides tooltip.

---

### Step 7 — Curve click-to-select + highlight rendering

Status: pending
Verification: click GR curve → glow; click empty area → deselects; Escape clears selection
Commit: —

**`viewStore.ts` additions:**

```ts
selectedElementId: string | null;
selectedElementType: 'curve' | 'track' | 'formation' | null;
selectElement: (id: string, type: 'curve' | 'track' | 'formation') => void;
clearSelection: () => void;
```

**`DataTrack.tsx` click handler:**

```ts
function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * devicePixelRatio;
  const depth = pixelToDepth(e.clientY - rect.top);
  let closest: { mnemonic: string; dist: number } | null = null;
  for (const { curve, style } of clippedCurves) {
    const pixelX = valueScales.get(style.mnemonic)!(interpolateAtDepth(curve.depths, curve.values, depth) ?? NaN);
    const dist = Math.abs(clickX - pixelX);
    if (dist <= 5 && (!closest || dist < closest.dist))
      closest = { mnemonic: style.mnemonic, dist };
  }
  if (closest) viewStore.selectElement(closest.mnemonic, 'curve');
  else viewStore.clearSelection();
}
```

**`curveRenderer.ts` update:**

```ts
export function drawCurve(
  ctx: CanvasRenderingContext2D,
  ...existing params...,
  isSelected = false,
): void {
  if (isSelected) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = style.color;
    ctx.lineWidth = style.lineWidth * 2;
  }
  // ... existing draw logic ...
  if (isSelected) {
    ctx.shadowBlur = 0;   // reset
    ctx.lineWidth = style.lineWidth;
  }
}
```

**`TrackHeader.tsx`:** wrap each column in a `<div onClick={() => viewStore.selectElement(track.id, 'track')}>` and apply `outline: 2px solid #3b82f6` when `viewStore.selectedElementId === track.id`.

**`App.tsx`:** `useEffect(() => { window.addEventListener('keydown', e => { if (e.key === 'Escape') viewStore.clearSelection() }) }, [])`.

**Acceptance criteria:** Click within ±5 px of GR curve → only GR highlights; click in empty track space → `clearSelection()`; Escape key clears; clicking a track header selects the track.

---

### Step 8 — PropertyPanel

Status: pending
Verification: change curve color → track redraws; close + reopen → color persists via visual config
Commit: —

**`src/components/sidebar/PropertyPanel.tsx`:**

```ts
function PropertyPanel(): JSX.Element | null {
  const { selectedElementId, selectedElementType } = useViewStore();
  if (!selectedElementId) return null;
  // render appropriate editor
}
```

**Formation editor** (when `selectedElementType === 'formation'`):

| Field | Control | On change |
|---|---|---|
| Name | `<input type="text">` | `PATCH .../formations/{id} { name }` + undo |
| Depth MD | `<input type="number" step="0.1">` | `wellDataStore.updateFormationDepth` (uses existing debounce) |
| Color | `<input type="color">` | `PATCH .../formations/{id} { color }` + undo |
| Lithology | `<select>` 9 options | `PATCH .../formations/{id} { lithology }` + undo |
| Locked | `<input type="checkbox">` | `PATCH .../formations/{id} { is_locked }` |

**Curve editor** (when `selectedElementType === 'curve'`):

| Field | Control | Range |
|---|---|---|
| Color | `<input type="color">` | — |
| Line width | `<input type="range">` | 0.5–4 px, step 0.5 |
| Scale min | `<input type="number">` | — |
| Scale max | `<input type="number">` | — |
| Line style | radio group | solid / dashed / dotted |
| Scale type | toggle | linear / log |

Curve changes call `wellDataStore.updateCurveConfig(mnemonic, patch)` (add this action) which updates `wellDataStore.layout.tracks[…].curves[…]` and calls `projectStore.saveVisualConfig({ curveConfigs: … })`.

**Track editor** (when `selectedElementType === 'track'`):

| Field | Control |
|---|---|
| Title | `<input type="text">` |
| Show grid | `<input type="checkbox">` |
| Grid divisions | `<input type="number">` |

**`MainLayout.tsx`** is a new wrapper around the existing `LogViewPanel` that adds a right sidebar column:

```tsx
<div style={{ display:'grid', gridTemplateColumns:`${leftW}px 1fr ${rightW}px`, height:'100vh' }}>
  <aside>{/* left sidebar — Step 9 */}</aside>
  <main><LogViewPanel /></main>
  <aside><PropertyPanel /></aside>
</div>
```

Right sidebar defaults to 220 px, collapses to 0 with a toggle button. Left sidebar added in Step 9.

**Acceptance criteria:** All three editor variants render; curve color change causes `DataTrack` to re-render in the same animation frame; visual config round-trip (close + reopen) preserves curve color changes.

---

### Step 9 — FormationTopsList sidebar + CurveBrowser

Status: pending
Verification: add via sidebar → overlay line appears; delete → disappears; click row → view centers
Commit: —

**`src/components/sidebar/FormationTopsList.tsx`:**

```ts
function FormationTopsList(): JSX.Element
```

Reads `wellDataStore.formations` sorted by `depth_md`. Renders a scrollable `<ul>` where each row contains:
- colored `<span>` (16 × 16 px swatch using `formation.color`)
- `{formation.name}` text
- `{formation.depth_md.toFixed(1)} m` secondary text
- `🔒` toggle button
- `✕` delete button

"＋ Add formation" button at top: calls `wellDataStore.addFormation({ name: 'New formation', depth_md: viewStore.cursorDepth ?? midDepth, color: '#808080', is_locked: false })`. New row scrolls into view and its name field activates for inline rename.

Row click:

```ts
viewStore.selectElement(formation.id, 'formation');
const halfView = (viewStore.visibleDepthRange.max - viewStore.visibleDepthRange.min) / 2;
viewStore.setScroll(formation.depth_md - halfView);
```

**`src/components/sidebar/CurveBrowser.tsx`:**

```ts
function CurveBrowser(): JSX.Element
```

Lists all `wellDataStore.well?.curves` sorted by mnemonic. Each row shows mnemonic, unit, and a `+` button. The `+` button is grayed out if the curve is already in the selected track. Clicking `+` calls `wellDataStore.addCurveToTrack(viewStore.selectedElementId, mnemonic)` (add this action) which appends a default `CurveConfig` to the track config.

**`MainLayout.tsx`** left sidebar (200 px, collapsible):

```tsx
<aside style={{ width: leftW, display:'flex', flexDirection:'column', overflow:'hidden' }}>
  <FormationTopsList style={{ flex: 1 }} />
  <CurveBrowser style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
</aside>
```

**Acceptance criteria:** Three-way interaction — add via sidebar → line in overlay → depth in FormationColumn → row in list all appear simultaneously; delete is mirrored in all three; sidebar click scrolls main view to formation depth.

---

### Step 10 — WellOverviewMinimap + well selector

Status: pending
Verification: drag minimap rect → view scrolls; switch wells → all tracks update
Commit: —

**`src/components/logview/WellOverviewMinimap.tsx`:**

```ts
interface WellOverviewMinimapProps {
  width?: number;    // default 80
  height: number;    // matches track area height
}
```

Uses `useCanvasRenderer`. Draw pass:
1. Clear to `#1e293b` background
2. For each curve in `wellDataStore.well.curves` (max 6): draw as 1 px line at the minimap's full-depth scale, using the curve's configured color at 60% opacity
3. For each `wellDataStore.formations`: draw a horizontal line across the minimap in `formation.color`
4. Draw viewport rect: `y = depthToMinimapPixel(viewStore.scrollDepth)`, height proportional to visible range, `rgba(59,130,246,0.25)` fill + `#3b82f6` stroke

Interaction:

```ts
function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
  const clickDepth = minimapPixelToDepth(e.nativeEvent.offsetY);
  viewStore.setScroll(clickDepth - visibleRange / 2);
  // pointer capture for drag
}
```

**Backend `GET /api/projects/wells`:**

```python
@router.get("/wells")
async def list_wells(request: Request) -> list[WellSummary]:
    with pm.session() as s:
        return [WellSummary(id=w.id, name=w.well_name, td_md=w.td_md)
                for w in s.query(WellModel).all()]
```

**`AppHeader.tsx` well selector:**

```tsx
<select value={wellDataStore.well?.id ?? ''} onChange={e => wellDataStore.loadWell(e.target.value)}>
  {wells.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
</select>
```

The `loadWell` action already fetches curves + formations and replaces the store state; all Canvas tracks re-render via Zustand subscriptions.

`WellOverviewMinimap` is placed in `LogViewPanel.tsx` as an absolute-positioned overlay anchored to the right edge of the track area (z-index 5, below InteractionOverlay at z-index 10).

**Acceptance criteria:** Click on minimap → main view jumps; drag minimap viewport rect → main view follows; switching wells via selector reloads curves and formation lines for the selected well.

---

## New and modified files

```
app/src/subsidence/
├── api/
│   ├── formations.py         NEW — GET/POST/PATCH/DELETE /api/projects/wells/{id}/formations
│   ├── projects.py           MODIFIED — visual-config GET/PATCH; export stubs; /wells list; /recent
│   └── main.py               MODIFIED — register formations router
└── data/
    └── undo.py               MODIFIED — add RemoveFormation command

frontend/src/
├── components/
│   ├── interaction/
│   │   ├── InteractionOverlay.tsx   NEW
│   │   ├── FormationTopLine.tsx     NEW
│   │   ├── DepthCursor.tsx          NEW
│   │   ├── CurveTooltip.tsx         NEW
│   │   └── index.ts                 NEW
│   ├── sidebar/
│   │   ├── PropertyPanel.tsx        NEW
│   │   ├── FormationTopsList.tsx    NEW
│   │   ├── CurveBrowser.tsx         NEW
│   │   └── index.ts                 NEW
│   ├── layout/
│   │   ├── MainLayout.tsx           NEW — CSS Grid wrapper: sidebar | log | panel
│   │   ├── StatusBar.tsx            NEW
│   │   ├── NewProjectDialog.tsx     NEW
│   │   ├── FileOpenDialog.tsx       NEW
│   │   └── index.ts                 MODIFIED — export new layout components
│   └── logview/
│       ├── LogViewPanel.tsx         MODIFIED — add InteractionOverlay, WellOverviewMinimap wrapper
│       ├── DataTrack.tsx            MODIFIED — onClick hit detection, isSelected highlight
│       ├── TrackHeader.tsx          MODIFIED — click-to-select border
│       ├── FormationColumn.tsx      MODIFIED — reads live wellDataStore.formations (no change if already wired)
│       └── WellOverviewMinimap.tsx  NEW
├── hooks/
│   └── useFormationDrag.ts          NEW
├── renderers/
│   └── curveRenderer.ts             MODIFIED — isSelected: glow + thicker line
├── stores/
│   ├── viewStore.ts                 MODIFIED — selectedElementId/Type, selectElement, clearSelection
│   ├── wellDataStore.ts             MODIFIED — addFormation, removeFormation, updateFormation, addCurveToTrack wired to API
│   └── projectStore.ts              MODIFIED — visualConfig CRUD
└── App.tsx                          MODIFIED — MainLayout, StatusBar, project dialogs gate
```

---

## Execution order

```
Step 1 (visual config API + store)
Step 2 (project dialogs)              ← parallel with Step 1
        ↓
Step 3 (formations API + store CRUD)
        ↓
Step 4 (InteractionOverlay + static lines + cursor)
        ↓
Step 5 (formation drag + undo)
Step 6 (DepthCursor readout + tooltip + StatusBar)  ← parallel with Step 5
        ↓
Step 7 (curve click-to-select + highlight)
        ↓
Step 8 (PropertyPanel)
        ↓
Step 9 (FormationTopsList + CurveBrowser + MainLayout)
        ↓
Step 10 (WellOverviewMinimap + well selector)
```

---

## Out of Scope for Phase 3

| Feature | Phase | Notes |
|---|---|---|
| WebSocket real-time recalculation | 4 | FormationTopLine drag is wired to undo + REST only; WS deferred |
| SubsidencePanel / burial history chart | 4 | `SubsidenceCanvas`, `GeologicalTimescale`, `SplitView` all Phase 4 |
| LTTB server-side curve downsampling | 4 | Client-side clipping is enough at current data volumes |
| Compaction parameter editing (φ₀, c) | 4 | `LithologyDictEntry` lacks these columns until Phase 4 adds them |
| Right-click context menus | 4 | Build after panel patterns are stable; context menu → PropertyPanel for now |
| Discrete curve import + renderer | 4 | `curve_type='discrete'` field exists in schema; importer + renderer deferred |
| Layout template save/load | 5 | |
| PNG/SVG export implementation | 5 | Stubs added in Step 1; full pixel rendering deferred |
| MD ↔ TVD toggle | 5 | Deviation survey stored; minimum-curvature transform deferred |
| DLIS / LAS 3.0 import | 5 | |
| Dark / light theme toggle | 5 | |
| Multi-user / cloud sync | 6+ | |
| Alembic migrations | 3+ | Not needed until schema changes post-Phase-3 |

---

## Definition of Done for Phase 3

- Cold start → `FileOpenDialog` shown; entering a valid `.subsidence` path loads well data and formation tops
- After resizing a track + saving, close and reopen → track width unchanged
- All formation tops from `import_tops_csv` appear as dashed lines at correct depths in the overlay
- Dragging a formation top updates depth in: overlay line, `FormationColumn`, `FormationTopsList`, and `StatusBar`; Ctrl+Z reverts
- Mouse movement across the track area updates `StatusBar` with `MD {depth} m`; `CurveTooltip` shows interpolated values for all loaded curves
- Clicking near a curve highlights it with glow effect; clicking empty space or pressing Escape deselects
- `PropertyPanel` shows correct editor for selected formation / curve / track; changes persist after close + reopen
- `FormationTopsList` sidebar: add a formation → line appears in overlay; delete → disappears; click row → view scrolls to depth
- `WellOverviewMinimap` shows full well with viewport rect; drag rect → main view follows; click → view jumps
- `npx tsc --noEmit` — zero errors
