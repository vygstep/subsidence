# Phase 5: Curve Fills, Subsidence Controls, Export, and Quality

**Goal**: Close the gaps left after Phase 4. Add crossover curve fills (the core petrophysical
overlay absent from the viewer), give the subsidence panel real controls (water depth history,
display options), add PNG export for reports, fix the audit-identified reliability issues, and
complete the context-menu interaction model deferred from Phase 3.

The architecture from Phases 1–4 (Canvas + SVG layering, Zustand stores, FastAPI backend) is
unchanged. Phase 5 is additive: no store refactoring, no renderer rewrites, no breaking API
changes.

**Status**: Not started.

---

## Progress

| Step | Status | Verification | Commit |
|---|---|---|---|
| Step 1  | ⏳ | | |
| Step 2  | ⏳ | | |
| Step 3  | ⏳ | | |
| Step 4  | ⏳ | | |
| Step 5  | ⏳ | | |
| Step 6  | ⏳ | | |
| Step 7  | ⏳ | | |
| Step 8  | ⏳ | | |
| Step 9  | ⏳ | | |
| Step 10 | ⏳ | | |

---

## Task Checklist

### Step 1 — Curve fill renderer: crossover and baseline fills

The `fillRenderer.ts` file exists with a `drawFill` stub. This step implements the two fill
modes used in real petrophysical interpretation.

- [ ] 1.1 Implement `drawCrossoverFill` in `frontend/src/renderers/fillRenderer.ts`:
      ```ts
      drawCrossoverFill(
        ctx: CanvasRenderingContext2D,
        depths1: Float32Array, values1: Float32Array,
        depths2: Float32Array, values2: Float32Array,
        depthScale: ScaleLinear, valueScale1: Scale, valueScale2: Scale,
        colorPositive: string, colorNegative: string, opacity: number,
      ): void
      ```
      Walk both depth arrays simultaneously (they share the same depth axis). For each sample
      pair, determine which curve is higher. Collect contiguous segments of the same sign,
      draw a closed polygon for each segment. Crossings (where curves swap order) must be
      interpolated to find the exact crossing depth and split the polygon there.

- [ ] 1.2 Implement `drawBaselineFill` in `fillRenderer.ts`:
      ```ts
      drawBaselineFill(
        ctx: CanvasRenderingContext2D,
        depths: Float32Array, values: Float32Array,
        baseline: number,
        depthScale: ScaleLinear, valueScale: Scale,
        colorAbove: string, colorBelow: string, opacity: number,
      ): void
      ```
      Simpler than crossover: fill between the curve and a constant `baseline` value.
      Same polygon-per-segment approach with crossing interpolation.

- [ ] 1.3 Extend `CurveConfig` in `frontend/src/types/index.ts`:
      ```ts
      export interface CurveFillConfig {
        type: 'crossover' | 'baseline'
        pairedMnemonic?: string   // for crossover
        baseline?: number         // for baseline
        colorPositive: string
        colorNegative: string
        opacity: number           // 0–1, default 0.25
      }
      ```
      Add `fill?: CurveFillConfig` to `CurveConfig`.

- [ ] 1.4 In `DataTrack.tsx`, after drawing all curves, iterate `config.curves` again; for
      any curve with `curve.fill` set, call the appropriate fill function. Order: fills drawn
      before curves (so fills appear behind lines).

- [ ] 1.5 In `SettingsInspector.tsx` curve branch: add a "Fill" subsection with a type
      dropdown (`none` / `baseline` / `crossover`), paired mnemonic selector (for crossover),
      baseline value input (for baseline), and two color pickers. On change, update
      `workspaceStore.updateWellViewState` with the new curve config.

- [ ] 1.6 In `CurvePresetLibrary` (or equivalent preset mechanism): set density-neutron
      crossover as the default fill for the RHOB/NPHI pair — yellow (`#ffe066`) when
      NPHI > RHOB (gas), gray (`#94a3b8`) when NPHI < RHOB (brine/wet).

- [ ] 1.7 Verify: add RHOB + NPHI to the same track → crossover fill appears between them;
      fill switches color at crossing depths; toggling fill type to `none` removes the fill;
      fill persists on project save/reload.

---

### Step 2 — Right-click context menus

Deferred from Phase 3. Context menus are the standard way to add/remove curves and formations
in a log viewer.

- [ ] 2.1 Create `frontend/src/components/layout/ContextMenu.tsx`: a generic positioned menu
      component. Props: `items: { label: string; icon?: string; action: () => void; disabled?: boolean; separator?: boolean }[]`,
      `position: { x: number; y: number }`, `onClose: () => void`.
      Rendered as a fixed-position `<div>` with `z-index: 1000`, dismissed on click-outside or
      Escape. No external library.

- [ ] 2.2 Track right-click → "Add curve…" and "Delete track":
      In `TrackHeader.tsx`, add `onContextMenu` handler. Menu items:
      - **Add curve…** → opens `CurveBrowser` in select mode (modal or inline popover)
      - **Rename track** → inline text edit on the header title
      - **Delete track** → `workspaceStore.updateWellViewState` removes the track; undo records it

- [ ] 2.3 Curve right-click in `TrackHeader.tsx` curve slot → "Edit properties", "Remove from track":
      - **Edit properties** → selects the curve in `viewStore` (already opens SettingsInspector)
      - **Remove from track** → removes `CurveConfig` from the track in `wellViewState`

- [ ] 2.4 Formation top right-click in `FormationTopLine.tsx`:
      Menu items: **Lock / Unlock**, **Set age…** (opens inline age input), **Delete**.
      - Lock/unlock: toggle `is_locked` via `PATCH /api/wells/{id}/formations/{fid}` with undo
      - Delete: `DELETE /api/wells/{id}/formations/{fid}` with undo

- [ ] 2.5 Verify: right-click a track header → menu appears at cursor; clicking "Delete track"
      removes it; right-clicking a formation line shows lock/delete; Escape dismisses without action.

---

### Step 3 — SubsidenceControls: display options and water depth input

`SubsidenceControls.tsx` is currently an empty stub. This step fills it with controls that
affect how the subsidence panel renders.

- [ ] 3.1 Add to `computedStore.ts`:
      ```ts
      showFormationFills: boolean    // default true
      showBurialCurves: boolean      // default true
      showAxesLabels: boolean        // default true
      waterDepthM: number            // default 0.0
      ```
      Actions: `setShowFormationFills`, `setShowBurialCurves`, `setShowAxesLabels`, `setWaterDepthM`.

- [ ] 3.2 Wire toggles into `SubsidenceCanvas.tsx`: guard `drawFormationFills` call with
      `showFormationFills`; guard `drawBurialCurves` with `showBurialCurves`.

- [ ] 3.3 Implement `SubsidenceControls.tsx`:
      ```tsx
      <div className="subsidence-controls">
        <label><input type="checkbox" checked={showFormationFills} onChange={…} /> Formation fills</label>
        <label><input type="checkbox" checked={showBurialCurves} onChange={…} /> Burial curves</label>
        <label>
          Water depth (m)
          <input type="number" step="10" min="0" value={waterDepthM}
            onChange={(e) => setWaterDepthM(Number(e.target.value))} />
        </label>
      </div>
      ```
      Changing `waterDepthM` calls `computedStore.triggerRecalculation()`.

- [ ] 3.4 Pass `waterDepthM` through the WebSocket message: add `water_depth_m` field to the
      JSON sent by `sendRecalculation`. Backend `ws_recalculate` reads it from the message and
      passes it to `backstrip(formations, litho_params, water_depth_m=water_depth_m)`.

- [ ] 3.5 Verify: toggle "Formation fills" → fills disappear without re-triggering computation;
      set water depth to 200 m → curves shift (deeper paleo-depths); set back to 0 → original.

---

### Step 4 — Depth axis legend and axes label improvements

Currently the subsidence canvas has bare axes. This step improves legibility for export.

- [ ] 4.1 Add axis title labels to `SubsidenceCanvas.tsx`:
      - Y-axis: rotated text "Depth (m)" drawn left of the Y axis
      - X-axis: text "Age (Ma)" centered below the X axis
      Both rendered in `drawAxes`, using `ctx.save() / ctx.rotate() / ctx.restore()`.

- [ ] 4.2 Add formation name labels at the right edge of each burial curve (at age = 0, i.e.,
      the present): draw small text labels aligned to the rightmost point of each curve.
      Guard with `showAxesLabels` from Step 3.

- [ ] 4.3 Make the Y-axis direction configurable — currently `depth` increases downward (burial
      view). Add `yAxisMode: 'depth' | 'elevation'` to `computedStore`. In elevation mode,
      Y = 0 at bottom, depths are negative (geological elevation above datum). Update `depthToY`
      mapping accordingly.

- [ ] 4.4 Verify: axis labels appear; formation names appear at present-day endpoints; toggling
      yAxisMode flips the Y axis.

---

### Step 5 — PNG export

- [ ] 5.1 Add `frontend/src/utils/exportPng.ts`:
      ```ts
      export async function exportLogViewPng(
        logCanvas: HTMLCanvasElement,
        subsCanvas: HTMLCanvasElement,
        filename?: string,
      ): Promise<void>
      ```
      Composites both canvases onto a single off-screen canvas (log left, subsidence right at
      current split ratio). Triggers browser download via `<a download>`.

- [ ] 5.2 Add `frontend/src/utils/exportSvg.ts` — export the subsidence canvas as an SVG path
      description. Use the same `draw*` functions but targeting a `Path2D` serializer.
      *Note: This is complex — limit Phase 5 to PNG only; SVG deferred to Phase 6.*

- [ ] 5.3 Add an "Export PNG" button to `WellViewerToolbar.tsx`. On click, call `exportLogViewPng`
      with refs to both canvases. Expose the canvas ref from `SubsidenceCanvas.tsx` via
      `useImperativeHandle` or a ref stored in `computedStore`.

- [ ] 5.4 Verify: click "Export PNG" → browser downloads a PNG; file contains both log and
      subsidence panels at screen resolution × `devicePixelRatio`; formation top lines from the
      SVG overlay are NOT included (Canvas only).

---

### Step 6 — Formation top age editing inline (in log view)

Currently, formation ages can only be set via the strat chart link or by importing tops with
pre-assigned ages. This step adds inline age editing directly from the formation top line
context menu.

- [ ] 6.1 Add "Set age…" in the formation top context menu (Step 2.4). Clicking opens a small
      popover anchored to the formation line with two numeric inputs:
      - **Age top (Ma)**: `age_top_ma` of this formation
      - For `unconformity` kind only: **Age base (Ma)**: `age_base_ma` (top of the hiatus)
      - **Formation kind**: dropdown — `strat` / `unconformity`

- [ ] 6.2 On confirm, `PATCH /api/wells/{id}/formations/{fid}` with
      `{ age_top_ma, age_base_ma?, kind }`. Route already exists in `formations.py`; verify it
      accepts these fields (add if missing).

- [ ] 6.3 After successful PATCH, call `triggerRecalculation()` to update subsidence curves.

- [ ] 6.4 In `SettingsInspector.tsx` formation branch (when a top-pick is selected): show age
      fields and kind dropdown as well. Any change triggers recalculation.

- [ ] 6.5 Verify: select a formation, set age to 50 Ma → subsidence curves update; set kind to
      `unconformity`, set base age to 55 Ma → hiatus appears in burial history; set kind back to
      `strat` → gap disappears.

---

### Step 7 — Reliability fixes (from audit)

Issues from `аудит кода после фазы 4.md` that are production-relevant.

- [ ] 7.1 **`pendingDepthPatches` stale cleanup**: in `wellDataStore.ts` `reset()`, iterate
      `pendingDepthPatches` and `clearTimeout` each timer before clearing the map.
      ```ts
      reset() {
        for (const timer of pendingDepthPatches.values()) clearTimeout(timer)
        pendingDepthPatches.clear()
        set({ well: null, … })
      }
      ```

- [ ] 7.2 **`isComputing` timeout**: in `computedStore.ts` `triggerRecalculation()`, set a
      30-second timeout that clears `isComputing` and sets `computeError` to `'Computation timed out'`.
      Cancel the timeout in `setResults()` and `clearResults()`:
      ```ts
      let computeTimeout: ReturnType<typeof setTimeout> | null = null
      triggerRecalculation() {
        if (computeTimeout) clearTimeout(computeTimeout)
        computeTimeout = setTimeout(() => {
          set({ isComputing: false, computeError: 'Computation timed out' })
        }, 30_000)
        …
      }
      ```

- [ ] 7.3 **`tkinter` in executor**: in `projects.py`, wrap all `filedialog` calls in
      `asyncio.to_thread`:
      ```python
      import asyncio
      path = await asyncio.to_thread(_pick_file_sync, title, filetypes)
      ```
      where `_pick_file_sync` is a synchronous helper that creates the tkinter root, calls
      `filedialog`, destroys the root, and returns the path.

- [ ] 7.4 **`activate_strat_chart` undo**: wrap the activation DB write in an `UndoCommand`
      so that undo after chart activation restores the previous active chart.

- [ ] 7.5 **`get_deviation` session safety**: move the parquet `data_uri` read inside the
      `with session:` block:
      ```python
      with session:
          survey_row = session.scalar(…)
          data_uri = survey_row.data_uri if survey_row else None
      if data_uri is None:
          raise HTTPException(404)
      df = pd.read_parquet(data_uri, …)
      ```

- [ ] 7.6 Verify: rapidly switch between two wells while dragging a formation → no stale PATCH
      fires for the previous well; kill backend during subsidence computation → `isComputing`
      clears after 30 s with error message; clicking "Open file" → dialog appears without
      blocking other API requests.

---

### Step 8 — `asyncio.to_thread` for backstrip computation

When the well has many formations, `_compute_subsidence` blocks the FastAPI event loop.

- [ ] 8.1 Make `ws_recalculate` in `subsidence.py` run `_compute_subsidence` in a thread pool:
      ```python
      import asyncio
      results = await asyncio.to_thread(_compute_subsidence, manager, well_id, water_depth_m)
      ```
      `_compute_subsidence` is already synchronous; wrapping it in `to_thread` is sufficient.

- [ ] 8.2 Stream a `{ status: 'computing', progress: 0.5 }` message after each major
      computation phase. With `to_thread` this requires a callback or a queue; use a simple
      approach: send `progress: 0.0` before the call, `progress: 1.0` with the complete
      results (no in-progress streaming needed for Phase 5).

- [ ] 8.3 Verify: while subsidence is computing, other API endpoints (e.g., `GET /api/projects/status`)
      respond without blocking; computation still completes and results appear in the UI.

---

### Step 9 — Keyboard shortcuts

- [ ] 9.1 Add global keydown handler in `App.tsx` (already has one for Escape):
      | Key | Action |
      |---|---|
      | `+` / `=` | zoom in (`depthPerPixel * 0.85`) |
      | `-` | zoom out (`depthPerPixel * 1.15`) |
      | `↑` / `↓` | scroll up / down by 10% of viewport height |
      | `Home` | scroll to top of well (`minDepth`) |
      | `End` | scroll to bottom of well (`maxDepth`) |
      | `Ctrl+Z` | `projectStore.undo()` |
      | `Ctrl+Y` / `Ctrl+Shift+Z` | `projectStore.redo()` |
      | `Delete` | delete selected formation top (with confirmation if `is_locked`) |
      | `L` | toggle lock on selected formation top |

- [ ] 9.2 Prevent shortcuts from firing when focus is inside an `<input>`, `<textarea>`, or
      `<select>` — check `document.activeElement.tagName`.

- [ ] 9.3 Show keyboard shortcut hints in the UI: tooltip on zoom buttons showing `+` / `-`,
      tooltip on undo/redo buttons showing `Ctrl+Z` / `Ctrl+Y`.

- [ ] 9.4 Verify: pressing `+` while hovering the log view zooms in; `Ctrl+Z` undoes the last
      formation move; `Delete` with a formation selected removes it; shortcuts don't fire when
      typing in an age input.

---

### Step 10 — Dark / light theme toggle

The CSS custom-property skeleton is in place. This step wires the toggle.

- [ ] 10.1 Audit `index.css` and extract all hardcoded color values into CSS custom properties
       under `:root {}`. Minimum set:
       ```css
       --color-bg-panel: #0f172a;
       --color-bg-track: #f0f5fa;
       --color-border: #c4d0dc;
       --color-text-primary: #e2e8f0;
       --color-text-secondary: #94a3b8;
       --color-axis: #475569;
       ```

- [ ] 10.2 Add a `[data-theme="light"]` override block with light-mode equivalents (print-like
       white background, dark text — suitable for exporting screenshots).

- [ ] 10.3 Add a theme toggle button to `ProjectToolbar.tsx`. Store current theme in
       `workspaceStore` as `theme: 'dark' | 'light'`. On mount, read from `localStorage`; on
       change, write to `localStorage` and set `document.documentElement.dataset.theme`.

- [ ] 10.4 Canvas renderers that hardcode colors (`#0f172a`, `#475569`, etc.) must read from
       CSS custom property values at draw time:
       ```ts
       const bg = getComputedStyle(canvas).getPropertyValue('--color-bg-panel').trim() || '#0f172a'
       ```

- [ ] 10.5 Verify: toggle to light mode → canvas backgrounds change to white; depth track
       labels readable in light; toggle back → dark restored; refresh → last theme remembered.

---

## Detailed Step Specifications

### Step 1 — Crossover fill rendering

**Crossing interpolation algorithm** (for `drawCrossoverFill`):

At each depth sample index `i`, compute `delta[i] = value1[i] - value2[i]`.
When `sign(delta[i]) !== sign(delta[i-1])` (a crossing), interpolate the crossing depth:
```ts
const t = delta[i-1] / (delta[i-1] - delta[i])
const crossDepth = depths[i-1] + t * (depths[i] - depths[i-1])
const crossX = valueScale1(value1[i-1] + t * (value1[i] - value1[i-1]))
const crossY = depthScale(crossDepth)
```
Close the current polygon at `(crossX, crossY)`, fill it, then start a new polygon in the
opposite color from `(crossX, crossY)`.

The winding order for polygon fill: trace curve1 forward (top to bottom), then trace curve2
backward (bottom to top), then close. This avoids self-intersections.

**Default fill configs for preset curves:**

| Pair | colorPositive | colorNegative | opacity | Meaning |
|---|---|---|---|---|
| NPHI (curve1) vs RHOB (curve2) | `#ffe066` (yellow) | `#94a3b8` (gray) | 0.35 | Yellow = gas indicator |
| GR vs baseline 75 API | `#fbbf24` (sand) | `#6b7280` (shale) | 0.30 | Sand vs shale cutoff |
| ILD vs ILM | `#f87171` (red) | `#60a5fa` (blue) | 0.20 | Invasion profile |

---

### Step 3 — SubsidenceControls + water depth

**Water depth correction in `backstrip.py`:**

The `backstrip()` function already accepts `water_depth_m: float = 0.0` and includes it in
the Airy correction formula:
```python
_ = total_col * (RHO_MANTLE - rho_s_avg) / (RHO_MANTLE - RHO_WATER) + water_depth_m
```
However this correction is currently discarded (`_`). In Phase 5, water depth shifts the
burial curve downward by the water column: the shallowest burial point of the youngest
formation should be at `water_depth_m` rather than 0. The simplest correct implementation:
add `water_depth_m` to every `paleo_tops[i]` value before recording the BurialPoint.

```python
for i in active_indices:
    results[i].burial_path.append(
        BurialPoint(age_ma=t_ma, depth_m=paleo_tops[i] + water_depth_m)
    )
```

This shifts the entire burial column by the water depth — correct for a non-zero water
depth at deposition time (assumes constant water depth throughout, Phase 6 adds time-varying).

**WebSocket message extension:**

```json
{ "well_id": "abc-123", "water_depth_m": 200.0 }
```

Frontend `sendRecalculation` sends this field (defaults to 0 if `waterDepthM` not set).

---

### Step 5 — PNG export

**Canvas compositing approach:**

The log view canvas and subsidence canvas are separate DOM elements. To export both:
1. Create an off-screen canvas sized `(logWidth + subsWidth) × max(logHeight, subsHeight)`
2. `ctx.drawImage(logCanvas, 0, 0, logWidth, height)`
3. `ctx.drawImage(subsCanvas, logWidth, 0, subsWidth, height)`
4. `canvas.toBlob('image/png')` → download

The SVG overlay (formation lines) is NOT captured by `toBlob` — it is a DOM element, not
canvas pixels. If formation lines are needed in the export, they must be re-rendered onto
the off-screen canvas. Phase 5 exports canvas-only (curves + fills + axes).

**Filename convention**: `{projectName}_{wellName}_{date}.png`
Example: `test-project_Well-A_2026-04-22.png`

---

### Step 7 — Reliability fixes

**`pendingDepthPatches` correction:**

`pendingDepthPatches` is declared at module level in `wellDataStore.ts`:
```ts
const pendingDepthPatches = new Map<string, ReturnType<typeof setTimeout>>()
```
This map survives hot-reload and well switches. The fix in `reset()` is necessary but not
sufficient — also cancel the timer when a new one is set for the same formation ID:
```ts
// In the debounce logic:
if (pendingDepthPatches.has(formationId)) {
  clearTimeout(pendingDepthPatches.get(formationId)!)
}
pendingDepthPatches.set(formationId, setTimeout(…, 300))
```
This is already the existing logic. The missing piece is the `reset()` cleanup.

---

## New and Modified Files

```
app/src/subsidence/
├── api/
│   ├── formations.py          MODIFIED — accept age_top_ma, age_base_ma, kind in PATCH
│   └── subsidence.py          MODIFIED — water_depth_m from WS message; asyncio.to_thread
├── data/
│   └── backstrip.py           MODIFIED — apply water_depth_m to burial points
└── api/projects.py            MODIFIED — tkinter calls in asyncio.to_thread

frontend/src/
├── renderers/
│   └── fillRenderer.ts        MODIFIED — implement drawCrossoverFill, drawBaselineFill
├── types/
│   └── index.ts               MODIFIED — CurveFillConfig, updated CurveConfig
├── stores/
│   ├── computedStore.ts       MODIFIED — showFormationFills, showBurialCurves,
│   │                                    waterDepthM, computeTimeout
│   └── wellDataStore.ts       MODIFIED — pendingDepthPatches cleared in reset()
├── api/
│   └── subsidenceSocket.ts    MODIFIED — send water_depth_m in message
├── utils/
│   └── exportPng.ts           NEW — exportLogViewPng
├── components/
│   ├── layout/
│   │   ├── ContextMenu.tsx    NEW — generic positioned context menu
│   │   ├── ProjectToolbar.tsx MODIFIED — export button, theme toggle
│   │   └── WellViewerToolbar.tsx MODIFIED — export PNG button
│   ├── logview/
│   │   ├── DataTrack.tsx      MODIFIED — call fill renderer before curves
│   │   ├── TrackHeader.tsx    MODIFIED — right-click context menu
│   │   └── FormationTopLine.tsx MODIFIED — right-click menu, age popover
│   └── subsidence/
│       └── SubsidenceControls.tsx MODIFIED — real controls (fills, curves, water depth)
│       └── SubsidenceCanvas.tsx   MODIFIED — axis labels, formation name labels, yAxisMode
└── index.css                  MODIFIED — CSS custom properties, [data-theme="light"]
```

---

## Execution Order

```
Step 7  (reliability fixes)        ← no dependencies, fixes bugs in prod now
Step 1  (curve fill renderer)      ← depends on types change; parallel with Step 7
Step 2  (context menus)            ← depends on nothing; parallel
  ↓
Step 3  (subsidence controls)      ← depends on Step 8 (asyncio.to_thread) for water depth
Step 8  (asyncio.to_thread)        ← parallel with Step 3 backend work
  ↓
Step 4  (axis labels)              ← depends on SubsidenceCanvas from Phase 4
Step 6  (age editing)              ← depends on Step 2 (context menu) for UI slot
  ↓
Step 5  (PNG export)               ← depends on canvas refs being stable
Step 9  (keyboard shortcuts)       ← depends on nothing; add last to avoid conflicts
Step 10 (dark theme)               ← depends on CSS variable audit from Step 10.1
```

---

## Out of Scope for Phase 5

| Feature | Phase | Notes |
|---|---|---|
| Sea-level curve correction (Haq87, Miller05) | 6 | Lookup tables not implemented; water depth stub (Step 3) is the prerequisite |
| Water depth history (time-varying) | 6 | Step 3 adds constant water depth; time-series UI is Phase 6 |
| Maturity / temperature overlays | 6 | Requires vitrinite reflectance model (Sweeney-Burnham) |
| Multi-well comparison | 6 | Shared time axis across wells requires store redesign |
| SVG export | 6 | Complex path serialization; PNG sufficient for Phase 5 |
| Alembic migrations | 6 | SQLAlchemy direct create works for single-machine use |
| Discrete curve import + renderer | 6 | Schema has `curve_type` field; renderer not started |
| Curve drag-to-track from CurveBrowser | 6 | Click-to-add works; drag deferred |
| Formation top sorting enforcement during drag | 6 | Depth ordering is not validated server-side |
| Multi-well project (multiple active wells) | 6 | Single-well viewer assumption throughout |

---

## Definition of Done for Phase 5

- Density-neutron crossover fill renders correctly between RHOB and NPHI curves with yellow/gray color switching at crossing depths
- Right-clicking a track header shows "Add curve…", "Rename", "Delete"; right-clicking a formation top shows "Set age…", "Lock/Unlock", "Delete"
- `SubsidenceControls` has working "Formation fills" and "Burial curves" checkboxes and a "Water depth (m)" input; changing water depth updates burial curves
- "Export PNG" button downloads a composite image containing the log view canvas and subsidence canvas
- Formation top age can be set inline (via context menu → "Set age…") and subsidence curves update immediately
- `reset()` clears all pending depth-patch timers; `isComputing` clears after 30 s on WS failure
- `tkinter` file dialogs do not block other API calls
- Keyboard shortcuts: `+`/`-` zoom, `↑`/`↓` scroll, `Ctrl+Z`/`Ctrl+Y` undo/redo, `Delete` removes selected formation
- Dark/light theme toggle works; last theme persists across page reload
- `npx tsc --noEmit` — zero errors
