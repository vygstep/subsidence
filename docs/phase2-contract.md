# Phase 2: Multi-Curve Tracks and Grids — Implementation Contract

**Goal**: Multiple curves per track, logarithmic grid, reversed scales, area fills between curves, stratigraphy column, depth scale zoom presets, and track resize by drag.

**Status**: Complete.

---

## Progress

| Step | Status | Verification | Commit |
|---|---|---|---|
| Step 1 | done | ILD track shows 4-decade log grid at 0.2 · 2 · 20 · 200 · 2000 | `da1c8b0` |
| Step 2 | done | GR track shows GR+CALI; Porosity shows RHOB+reversed NPHI | `b52c6ca` |
| Step 3 | done | `npx tsc --noEmit` passes with zero errors | `0315723` |
| Step 4 | done | fillRenderer builds cleanly and renderers contain zero React imports | `893681e` |
| Step 5 | done | Porosity shows crossover fill; GR track shows baseline shading | `a4bc874` |
| Step 6 | done | Formation column shows aligned lithology blocks with readable names | `f824756` |
| Step 7 | done | Ctrl+Wheel zooms depth axis; preset buttons snap to 1:200 / 1:500 / 1:1000 | `c3d3983` |
| Step 8 | done | Dragging a handle resizes the track and header together; minimum width stays at 80 px | `0fcac70` |

---

## Task Checklist

### Step 1 - Logarithmic grid renderer
- [x] 1.1 Add `drawLogarithmicGrid(ctx, xScale, decades, width, height, color)` to `src/renderers/gridRenderer.ts`
- [x] 1.2 Update `DataTrack.tsx`: call `drawLogarithmicGrid` when `config.scaleType === 'logarithmic'`
- [x] 1.3 Verify: ILD (Resistivity) track shows 4-decade log grid lines at 0.2 · 2 · 20 · 200 · 2000

### Step 2 - Multi-curve track configs
- [x] 2.1 Add `CALI` curve to GR track config (`GR` green + `CALI` black dashed, 6–16 in)
- [x] 2.2 Add `NPHI` curve to Porosity track config (`RHOB` red + `NPHI` blue dashed, reversed 0.45 > -0.15)
- [x] 2.3 Verify each curve in `DataTrack` uses its own scale (confirm via visual: NPHI runs right-to-left)
- [x] 2.4 Verify: GR track shows two curves; Porosity track shows two curves with correct reversed NPHI

### Step 3 - CurveFillConfig type
- [x] 3.1 Add `CurveFillConfig` interface to `src/types/tracks.ts`
- [x] 3.2 Add optional `fill?: CurveFillConfig` field to `CurveConfig`
- [x] 3.3 Verify: `npx tsc --noEmit` passes with zero errors

### Step 4 - fillRenderer.ts
- [x] 4.1 Write `src/renderers/fillRenderer.ts`: `drawFillToBaseline`
- [x] 4.2 Write `drawFillBetweenCurves` with crossover detection in `fillRenderer.ts`
- [x] 4.3 Export from `src/renderers/index.ts`
- [x] 4.4 Verify: renderers are pure functions (no React imports); crossover detection switches fill colour at intersection points

### Step 5 - Wire fills in DataTrack
- [x] 5.1 Update `DataTrack.tsx`: before drawing curves, call fill renderers for any `CurveConfig` with `fill` defined
- [x] 5.2 Add crossover fill config to Porosity track: NPHI > RHOB > yellow (gas), NPHI < RHOB > grey
- [x] 5.3 Add baseline fill config to GR track: left of 75 API > sand-yellow, right > grey-green
- [x] 5.4 Verify: Porosity track shows yellow crossover fill; GR track shows baseline shading

### Step 6 - FormationColumn
- [x] 6.1 Write `src/renderers/lithologyRenderer.ts`: `drawLithologyBlock(ctx, pattern, x, y, w, h)` for sandstone, shale, limestone, dolomite
- [x] 6.2 Write `src/components/logview/FormationColumn.tsx`: reads `formations` from `wellDataStore`, draws coloured depth blocks + names
- [x] 6.3 Export from `src/components/logview/index.ts`
- [x] 6.4 Add `FormationColumn` to `LogViewPanel` as the rightmost track
- [x] 6.5 Verify: formation column shows coloured blocks aligned with the correct depth range; names are readable

### Step 7 - Depth scale presets (zoom)
- [x] 7.1 Extend `useSynchronizedScroll`: if `e.ctrlKey` > adjust `depthPerPixel` instead of scrolling (zoom in/out around cursor depth)
- [x] 7.2 Write `src/components/layout/ZoomControl.tsx`: three buttons `1:200` · `1:500` · `1:1000`, active state on current scale
- [x] 7.3 Add `ZoomControl` to `app-topbar` in `App.tsx`
- [x] 7.4 Export from `src/components/index.ts`
- [x] 7.5 Verify: Ctrl+Wheel zooms the depth axis; clicking preset buttons snaps to the correct scale

### Step 8 - Track resize via drag
- [x] 8.1 Add `setTrackWidth(id: string, width: number)` action to `viewStore.ts`
- [x] 8.2 Write `src/components/logview/TrackResizeHandle.tsx`: thin drag handle rendered between adjacent tracks
- [x] 8.3 Update `LogViewPanel.tsx`: read track widths from `viewStore.trackWidths`, render `TrackResizeHandle` between each `DataTrack`
- [x] 8.4 Update `TrackHeaderRow.tsx`: track header widths also read from `viewStore.trackWidths`
- [x] 8.5 Verify: dragging a handle resizes the track and its header simultaneously; minimum track width 80 px

---

## Detailed step specifications

### Step 1 - Logarithmic grid renderer

Status: done
Verification: ILD track displays vertical lines at 0.2, 2, 20, 200, 2000 with minor subdivisions between each decade
Commit: `da1c8b0`

Add to `src/renderers/gridRenderer.ts`:

```ts
export function drawLogarithmicGrid(
  ctx: CanvasRenderingContext2D,
  xScale: ScaleLogarithmic<number, number>,
  decades: number,
  width: number,
  height: number,
  color: string,
): void
```

Algorithm: walk `10^n` values from domain start to end (e.g. 0.2 > 2 > 20 > 200 > 2000). For each decade, draw the major gridline at `10^n` plus 8 minor lines at `2?10^n … 9?10^n`. Major lines darker than minor.

Update `DataTrack.tsx` draw sequence:
```
clear > grid (linear or log) > depth gridlines > fills > curves
```

**Acceptance criteria:** ILD track displays vertical lines at 0.2, 2, 20, 200, 2000 with minor subdivisions between each decade.

---

### Step 2 - Multi-curve track configs

Status: done
Verification: GR track renders GR+CALI, and Porosity renders RHOB+reversed NPHI from the sample well
Commit: `b52c6ca`

Update `DEFAULT_TRACKS` in `App.tsx`:

```ts
// GR track: add CALI overlay
{ mnemonic: 'CALI', unit: 'in', color: '#374151', lineWidth: 1, lineStyle: 'dashed',
  scaleMin: 6, scaleMax: 16, scaleReversed: false }

// Porosity track: add NPHI overlay (reversed scale)
{ mnemonic: 'NPHI', unit: 'v/v', color: '#3b82f6', lineWidth: 1.5, lineStyle: 'dashed',
  scaleMin: 0.45, scaleMax: -0.15, scaleReversed: true }
```

`DataTrack` already computes per-curve scales — this step only requires updating config. No component changes needed.

**Acceptance criteria:** GR track renders `GR` (green solid) + `CALI` (grey dashed). Porosity track renders `RHOB` (red solid) + `NPHI` (blue dashed, right-to-left).

---

### Step 3 - CurveFillConfig type

Status: done
Verification: `npx tsc --noEmit` passes with zero errors
Commit: `0315723`

Add to src/types/tracks.ts:

```ts
export interface CurveFillConfig {
  type: 'to-baseline' | 'between-curves' | 'crossover'
  baseline?: number          // depth value; used with 'to-baseline'
  pairedCurve?: string       // mnemonic; used with 'between-curves' and 'crossover'
  colorPositive: string      // fill colour when curve > baseline or paired curve
  colorNegative: string      // fill colour when curve < baseline or paired curve
  opacity: number            // 0–1
}
```

Add to `CurveConfig`:
```ts
fill?: CurveFillConfig
```

---

### Step 4 - fillRenderer.ts

Status: done
Verification: `npx tsc --noEmit` passes, build passes, and renderer files contain zero React imports
Commit: `893681e`

Create src/renderers/fillRenderer.ts:

```ts
export function drawFillToBaseline(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  baseline: number,
  depthScale: ScaleLinear<number, number>,
  valueScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  colorAbove: string,   // fill when value > baseline
  colorBelow: string,   // fill when value < baseline
  opacity: number,
  nullValue: number | null,
): void

export function drawFillBetweenCurves(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values1: Float32Array,  // primary curve (e.g. RHOB)
  values2: Float32Array,  // paired curve (e.g. NPHI), same depth array
  depthScale: ScaleLinear<number, number>,
  valueScale1: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  valueScale2: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  colorPositive: string,  // fill when values1 > values2
  colorNegative: string,  // fill when values1 < values2
  opacity: number,
  nullValue: number | null,
): void
```

Crossover algorithm for `drawFillBetweenCurves`:
1. Walk depth samples in pairs `[i, i+1]`
2. For each pair, compute `x1_a, x1_b` (pixel-x for curve1 at i and i+1) and `x2_a, x2_b` (same for curve2)
3. If both points are same side > fill one rectangle segment with that colour
4. If sides differ > compute the crossover pixel-x via linear interpolation, fill two triangular segments with different colours
5. Use `ctx.beginPath()` per filled polygon; `ctx.fill()` immediately

This approach handles smooth crossover transitions without gaps or overlaps.

---

### Step 5 - Wire fills in DataTrack

Status: done
Verification: Porosity track shows yellow crossover fill, and GR track shows baseline shading
Commit: `a4bc874`

Update DataTrack.tsx draw callback — before drawing curves, iterate clippedCurves and call fill renderers for any curve with style.fill defined:

```ts
// Fill pass (before curve lines)
clippedCurves.forEach(({ curve, style }) => {
  if (!style.fill) return
  const valueScale = curveScales.get(style.mnemonic)
  if (!valueScale) return

  if (style.fill.type === 'to-baseline' && style.fill.baseline !== undefined) {
    drawFillToBaseline(ctx, curve.depths, curve.values, style.fill.baseline,
      depthScale, valueScale, style.fill.colorPositive, style.fill.colorNegative,
      style.fill.opacity, curve.null_value)
  }

  if (style.fill.type === 'crossover' && style.fill.pairedCurve) {
    const paired = clippedCurves.find(c => c.style.mnemonic === style.fill!.pairedCurve)
    const pairedScale = paired ? curveScales.get(paired.style.mnemonic) : undefined
    if (paired && pairedScale) {
      drawFillBetweenCurves(ctx, curve.depths, curve.values, paired.curve.values,
        depthScale, valueScale, pairedScale,
        style.fill.colorPositive, style.fill.colorNegative,
        style.fill.opacity, curve.null_value)
    }
  }
})

// Curve line pass (on top of fills)
clippedCurves.forEach(({ curve, style }) => { ... })
```

Update `DEFAULT_TRACKS` in `App.tsx` to add fill configs:

- **GR**: `fill: { type: 'to-baseline', baseline: 75, colorPositive: '#fef3c7', colorNegative: '#d1fae5', opacity: 0.5 }`
- **RHOB**: `fill: { type: 'crossover', pairedCurve: 'NPHI', colorPositive: '#fef9c3', colorNegative: '#e5e7eb', opacity: 0.45 }`

---

### Step 6 - FormationColumn

Status: done
Verification: formation column shows aligned lithology blocks with readable names from the sample API
Commit: `f824756`

**src/renderers/lithologyRenderer.ts:**

```ts
export type LithologyPattern = 'sandstone' | 'shale' | 'limestone' | 'dolomite'
  | 'evaporite' | 'igneous' | 'coal' | 'conglomerate'

export function drawLithologyBlock(
  ctx: CanvasRenderingContext2D,
  lithology: LithologyPattern | undefined,
  color: string,
  x: number, y: number, width: number, height: number,
): void
```

Each lithology uses a repeating Canvas pattern:
- `sandstone` — stippled dots
- `shale` — horizontal lines
- `limestone` — brick pattern
- `dolomite` — rhombus hatch
- Others — solid fill with colour tint

**`src/components/logview/FormationColumn.tsx`:**

```ts
interface FormationColumnProps {
  height: number
  width?: number   // default 80px
}
```

Reads `formations` from `useWellDataStore`. For each `FormationTop`, computes the depth block from its `depth_md` to the next formation's `depth_md` (or `maxDepth`). Draws via `drawLithologyBlock`, then adds a text label centered in the block.

Add `FormationColumn` to `LogViewPanel` between the last `DataTrack` and the right edge:

```tsx
<FormationColumn height={trackHeight} />
```

**Acceptance criteria:** Column shows coloured depth blocks with formation names. Blocks scroll in sync with the other tracks.

---

### Step 7 - Depth scale presets (zoom)

Status: done
Verification: Ctrl+Wheel zoom keeps cursor depth fixed, and preset buttons switch between 1:200 / 1:500 / 1:1000 with active highlight
Commit: `c3d3983`

**Ctrl+Wheel zoom in `useSynchronizedScroll`:**

```ts
if (e.ctrlKey) {
  e.preventDefault()
  const { depthPerPixel, scrollDepth } = stateRef.current
  const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15
  const newDpp = Math.max(0.05, Math.min(5.0, depthPerPixel * zoomFactor))
  // Keep the depth at the cursor position fixed during zoom
  const cursorDepth = scrollDepth + (e.offsetY * depthPerPixel)
  const newScrollDepth = cursorDepth - (e.offsetY * newDpp)
  setScale(newDpp)
  setScroll(Math.max(minDepth, Math.min(maxDepth, newScrollDepth)))
  return
}
```

**`src/components/layout/ZoomControl.tsx`:**

```ts
const PRESETS = [
  { label: '1:200',  dpp: 0.2  },
  { label: '1:500',  dpp: 0.5  },
  { label: '1:1000', dpp: 1.0  },
]
```

Reads `depthPerPixel` from `viewStore`. Active preset button highlighted. Clicking calls `setScale(dpp)`.

Add to `app-topbar` in `App.tsx` between the well name and meta info.

**Acceptance criteria:** Ctrl+Wheel zooms the depth axis with the cursor depth staying fixed. Preset buttons snap to the correct scale and update the active highlight.

---

### Step 8 - Track resize via drag

Status: done
Verification: drag handles resize headers and canvases together for MD, data tracks, and Formations with a minimum width of 80 px
Commit: `0fcac70`

**`viewStore.ts`** — add action:
```ts
setTrackWidth: (id: string, width: number) => void
```

`setTrackWidth` writes to `trackWidths[id]` and clamps to minimum 80px.

**`src/components/logview/TrackResizeHandle.tsx`:**

```ts
interface TrackResizeHandleProps {
  trackId: string         // the track to the left of this handle
  initialWidth: number
}
```

Renders a 6px wide vertical divider. On `mousedown`, attaches `mousemove` and `mouseup` to `document`. On `mousemove`, computes `dx` from `mousedown` origin and calls `viewStore.setTrackWidth(trackId, initialWidth + dx)`. Releases on `mouseup`.

**`LogViewPanel.tsx`** — interleave handles between tracks:
```tsx
{tracks.map((track, i) => (
  <>
    <DataTrack key={track.id} config={{ ...track, width: trackWidths[track.id] ?? track.width }} ... />
    {i < tracks.length - 1 && (
      <TrackResizeHandle key={`${track.id}-handle`} trackId={track.id} initialWidth={trackWidths[track.id] ?? track.width} />
    )}
  </>
))}
```

**`TrackHeaderRow.tsx`** — read widths from `viewStore.trackWidths`, fall back to `track.width`.

**Acceptance criteria:** Drag a handle right/left — the track and its header resize together in real time. Cannot drag below 80px. Releasing the mouse stops the resize.

---

## New and modified files

```
frontend/src/
+-- types/
¦   L-- tracks.ts              MODIFIED — CurveFillConfig, fill field on CurveConfig
+-- renderers/
¦   +-- gridRenderer.ts        MODIFIED — drawLogarithmicGrid
¦   +-- fillRenderer.ts        NEW — drawFillToBaseline, drawFillBetweenCurves
¦   +-- lithologyRenderer.ts   NEW — drawLithologyBlock
¦   L-- index.ts               MODIFIED — export fillRenderer, lithologyRenderer
+-- components/
¦   +-- layout/
¦   ¦   +-- ZoomControl.tsx    NEW
¦   ¦   L-- index.ts           NEW
¦   L-- logview/
¦       +-- DataTrack.tsx      MODIFIED — fill pass before curve pass
¦       +-- FormationColumn.tsx NEW
¦       +-- LogViewPanel.tsx   MODIFIED — FormationColumn, TrackResizeHandle
¦       +-- TrackHeaderRow.tsx MODIFIED — read widths from viewStore
¦       +-- TrackResizeHandle.tsx NEW
¦       L-- index.ts           MODIFIED — export new components
+-- stores/
¦   L-- viewStore.ts           MODIFIED — setTrackWidth action
L-- App.tsx                    MODIFIED — multi-curve configs, fill configs, ZoomControl
```

---

## Execution order

```
Step 1 (log grid)
Step 2 (multi-curve configs)  < can run parallel with Step 1
        v
Step 3 (fill types)
        v
Step 4 (fillRenderer)
        v
Step 5 (wire fills in DataTrack)
        v
Step 6 (FormationColumn)      < can run parallel with Step 5
        v
Step 7 (zoom)
Step 8 (track resize)         < can run parallel with Step 7
```

---

## Definition of Done for Phase 2

- GR track: `GR` (green solid) + `CALI` (grey dashed) with GR baseline fill
- Resistivity track: `ILD` (red) on 4-decade log grid with correct minor subdivisions
- Porosity track: `RHOB` (red) + `NPHI` (blue, reversed) with yellow/grey crossover fill
- Formation column: coloured depth blocks with names, scrolls in sync
- Ctrl+Wheel zooms depth axis; cursor depth stays fixed during zoom
- `1:200` / `1:500` / `1:1000` buttons in topbar snap to the correct scale
- Track width resizable by drag; header and canvas resize together; minimum 80 px
- `npx tsc --noEmit` — zero errors














