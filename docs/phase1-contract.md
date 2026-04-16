# Phase 1: Foundation - Implementation Contract

**Goal**: Render static well log curves from a LAS file in the browser with synchronized scrolling across all tracks. No calculations yet.

---

## Progress

| Step | Status | Verification | Commit |
|---|---|---|---|
| Step 1 | done | `npm run dev` serves blank app with no console errors | `9a03010` |
| Step 2 | done | `npx tsc --noEmit` passes with zero errors | `ce3a984` |
| Step 3 | done | `curl http://localhost:8000/api/wells/sample` returns valid JSON with curves | `bd72ea3` |
| Step 4 | done | `loadWell("sample")` logs curves as `Float32Array` in browser console | `40f0847` |
| Step 5 | done | test component renders sine wave; no flicker on window resize | `e02d07c` |
| Step 6 | done | renderers have zero React imports and build passes | `577bb81` |
| Step 7 | done | depth labels preview shows 1000 m, 1100 m, 1200 m at the expected range | pending |
| Step 8 | pending | - | - |
| Step 9 | pending | - | - |
| Step 10 | pending | - | - |

---

## Task Checklist

### Step 1 - Frontend scaffold
- [x] 1.1 Run `npm create vite@latest frontend -- --template react-ts`
- [x] 1.2 Install deps: `zustand d3-scale d3-array tailwindcss @types/d3-scale @types/d3-array`
- [x] 1.3 Configure `vite.config.ts`: proxy `/api` -> `localhost:8000`
- [x] 1.4 Configure `tsconfig.json`: strict mode + paths alias `@/` -> `src/`
- [x] 1.5 Create full `src/` directory tree + empty `index.ts` barrel files
- [x] 1.6 Verify: `npm run dev` serves blank app with no console errors

### Step 2 - TypeScript types
- [x] 2.1 Write `src/types/well.ts`: `Well`, `CurveData`, `FormationTop`, `LithologyType`
- [x] 2.2 Write `src/types/tracks.ts`: `TrackConfig`, `CurveConfig`
- [x] 2.3 Verify: `npx tsc --noEmit` passes with zero errors

### Step 3 - FastAPI well data endpoint
- [x] 3.1 Add sample LAS file to `app/data/sample.las`
- [x] 3.2 Add CORS middleware to `app/src/subsidence/api/main.py`
- [x] 3.3 Write `app/src/subsidence/api/wells.py`: `GET /api/wells/sample`
- [x] 3.4 Wire `wells.py` to existing `loaders.load_las_curves()`
- [x] 3.5 Verify: `curl http://localhost:8000/api/wells/sample` returns JSON with at least one curve

### Step 4 - Zustand stores
- [x] 4.1 Write `src/stores/wellDataStore.ts` with `loadWell` (fetch + Float32Array conversion)
- [x] 4.2 Write `src/stores/viewStore.ts` with `scrollDepth`, `depthPerPixel`, `visibleDepthRange`
- [x] 4.3 Verify: `loadWell("sample")` logs curves as `Float32Array` in browser console

### Step 5 - Canvas hooks
- [x] 5.1 Write `src/hooks/useCanvasRenderer.ts`: RAF + `devicePixelRatio` + `ResizeObserver`
- [x] 5.2 Write `src/hooks/useDepthScale.ts`: d3 `scaleLinear` depth -> pixel-Y
- [x] 5.3 Write `src/hooks/useValueScale.ts`: d3 `scaleLinear`/`scaleLog`, reversed support
- [x] 5.4 Verify: test component renders sine wave; no flicker on window resize

### Step 6 - Renderers (pure functions)
- [x] 6.1 Write `src/renderers/gridRenderer.ts`: `drawLinearGrid` + `drawDepthGridlines`
- [x] 6.2 Write `src/renderers/curveRenderer.ts`: `drawCurve` with `Path2D`, null gap handling
- [x] 6.3 Write `src/renderers/depthLabelsRenderer.ts`: `drawDepthLabels`
- [x] 6.4 Verify: renderers have zero React imports; callable as plain functions

### Step 7 - DepthTrack
- [x] 7.1 Write `src/components/logview/DepthTrack.tsx`: 60 px wide, depth labels + gridlines
- [x] 7.2 Verify: at `scrollDepth=1000`, labels `1000 m`, `1100 m`, `1200 m` appear at correct pixel positions

### Step 8 - DataTrack
- [ ] 8.1 Write `src/components/logview/DataTrack.tsx`: Canvas, binary-search clip, draw loop
- [ ] 8.2 Verify: GR (green, 0-150 API) renders correctly; no crash when scrolling past data end

### Step 9 - Track headers
- [ ] 9.1 Write `src/components/logview/CurveScaleBar.tsx`: mnemonic + unit + color bar
- [ ] 9.2 Write `src/components/logview/TrackHeader.tsx`: 80 px tall, stacked `CurveScaleBar`s
- [ ] 9.3 Write `src/components/logview/TrackHeaderRow.tsx`: `position: sticky; top: 0` flex row
- [ ] 9.4 Verify: GR header reads `GR / API / 0 <-> 150` in green and stays visible while track area scrolls

### Step 10 - LogViewPanel + synchronized scroll
- [ ] 10.1 Write `src/hooks/useSynchronizedScroll.ts`: wheel -> depth delta -> `viewStore`
- [ ] 10.2 Write `src/components/logview/LogViewPanel.tsx`: sticky header + 4-track flex row
- [ ] 10.3 Define default 4-track layout config (Depth, GR, ILD, RHOB)
- [ ] 10.4 Verify: all 4 tracks scroll in sync at 60 fps; no overscroll past data bounds

---

## Repository Layout After Phase 1

```text
subsidence/
|- app/                                  # Python backend
|  |- data/
|  |  |- sample.las
|  |- src/subsidence/
|  |  |- api/
|  |  |  |- main.py
|  |  |  |- wells.py
|  |  |- core/
|  |  |- data/
|  |     |- __init__.py
|  |     |- loaders.py
|  |     |- models.py
|  |     |- unit_conversion.py
|  |- tests/
|  |- pyproject.toml
|- frontend/
|  |- package.json
|  |- tsconfig.json
|  |- tsconfig.app.json
|  |- tsconfig.node.json
|  |- vite.config.ts
|  |- src/
|     |- types/
|     |- stores/
|     |- hooks/
|     |- renderers/
|     |- components/logview/
|- docs/
|  |- app_compass.md
|  |- phase1-contract.md
|  |- current-truth.md
|  |- reference-sources.md
```

---

## Step 1 - Frontend scaffold

Status: done
Verification: `npm run dev` serves blank app with no console errors
Commit: `9a03010`

Create `frontend/` using Vite + React + TypeScript.

Dependencies:

```text
zustand d3-scale d3-array tailwindcss @types/d3-scale @types/d3-array
```

Requirements:

- configure `vite.config.ts` to proxy `/api` to `http://localhost:8000`
- configure TypeScript strict mode
- configure alias `@/` -> `src/`
- create the full `src/` directory tree
- add empty `index.ts` barrel exports in each directory

---

## Step 2 - TypeScript types

Status: done
Verification: `npx tsc --noEmit` passes with zero errors
Commit: `ce3a984`

Implement the following files:

- `src/types/well.ts`
- `src/types/tracks.ts`

`src/types/well.ts` must define:

```ts
interface Well {
  well_id: string;
  well_name: string;
  kb_elev: number;
  td_md: number;
  x: number;
  y: number;
  crs: string;
}

interface CurveData {
  mnemonic: string;
  unit: string;
  depths: Float32Array;
  values: Float32Array;
  null_value: number;
}

interface FormationTop {
  id: string;
  name: string;
  depth_md: number;
  age_ma?: number;
  color: string;
  is_locked: boolean;
  lithology?: LithologyType;
}

type LithologyType =
  | 'sandstone' | 'shale' | 'limestone' | 'dolomite'
  | 'evaporite' | 'igneous' | 'metamorphic' | 'coal' | 'conglomerate';
```

`src/types/tracks.ts` must define:

```ts
interface TrackConfig {
  id: string;
  title: string;
  width: number;
  curves: CurveConfig[];
  scaleType: 'linear' | 'logarithmic';
  gridDivisions: number;
  showGrid: boolean;
}

interface CurveConfig {
  mnemonic: string;
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  scaleMin: number;
  scaleMax: number;
  scaleReversed: boolean;
}
```

---

## Step 3 - FastAPI well data endpoint

Status: done
Verification: `curl http://localhost:8000/api/wells/sample` returns valid JSON with curves
Commit: `bd72ea3`

`app/src/subsidence/api/main.py` must:

- add CORS middleware
- allow `http://localhost:5173`
- register the wells router under `/api`

`app/src/subsidence/api/wells.py` must expose:

```text
GET /api/wells/sample
```

Response shape:

```json
{
  "well_id": "sample",
  "well_name": "SAMPLE-1",
  "curves": [
    { "mnemonic": "GR", "unit": "API", "depths": [...], "values": [...], "null_value": -999.25 }
  ],
  "formations": []
}
```

Data source:

- `app/data/sample.las`
- parsed through `loaders.load_las_curves()`
- single hardcoded sample well for Phase 1

---

## Step 4 - Zustand stores

Status: done
Verification: `loadWell("sample")` logs curves as `Float32Array` in browser console
Commit: `40f0847`

`src/stores/wellDataStore.ts`:

```ts
interface WellDataStore {
  well: Well | null;
  curves: CurveData[];
  formations: FormationTop[];
  isLoading: boolean;
  error: string | null;
  loadWell: (wellId: string) => Promise<void>;
}
```

`loadWell` must fetch `GET /api/wells/{id}` and convert plain number arrays to `Float32Array`.

`src/stores/viewStore.ts`:

```ts
interface ViewStore {
  scrollDepth: number;
  depthPerPixel: number;
  visibleDepthRange: { min: number; max: number };
  cursorDepth: number | null;
  trackWidths: Record<string, number>;
  setScroll: (depth: number) => void;
  setScale: (dpp: number) => void;
  setCursorDepth: (depth: number | null) => void;
}
```

`visibleDepthRange` is a derived value recomputed whenever `scrollDepth`, `depthPerPixel`, or viewport height changes.

---

## Step 5 - Canvas hooks

Status: done
Verification: sine-wave canvas renders and remains stable on window resize
Commit: pending

Implement:

- `src/hooks/useCanvasRenderer.ts`
- `src/hooks/useDepthScale.ts`
- `src/hooks/useValueScale.ts`

Requirements:

- `useCanvasRenderer` handles `devicePixelRatio`, `ResizeObserver`, and RAF-driven redraw
- `useDepthScale` exposes depth -> pixel and pixel -> depth mapping
- `useValueScale` supports linear/log scale and reversed ranges
- a throwaway test component must render a sine wave through these hooks

---

## Step 6 - Renderers (pure functions, no React)`r`n`r`nStatus: done`r`nVerification: renderers have zero React imports and draw via plain function calls`r`nCommit: pending

Implement:

- `src/renderers/gridRenderer.ts`
- `src/renderers/curveRenderer.ts`
- `src/renderers/depthLabelsRenderer.ts`

`gridRenderer.ts`:

```ts
drawLinearGrid(ctx, xScale, divisions, width, height, color): void
drawDepthGridlines(ctx, depthScale, width, majorInterval, minorInterval): void
```

`curveRenderer.ts`:

```ts
drawCurve(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  depthScale: ScaleLinear,
  valueScale: ScaleLinear | ScaleLogarithmic,
  style: { color: string; lineWidth: number; lineStyle: 'solid' | 'dashed' | 'dotted' }
): void
```

Requirements:

- skip `null_value` segments
- use `Path2D`
- use a single `beginPath()` per continuous segment

`depthLabelsRenderer.ts`:

```ts
drawDepthLabels(ctx, depthScale, width, majorInterval): void
```

---

## Step 7 - DepthTrack`r`n`r`nStatus: done`r`nVerification: with `scrollDepth=1000` and `depthPerPixel=0.2`, labels align correctly`r`nCommit: pending

Implement `src/components/logview/DepthTrack.tsx`.

Requirements:

- fixed width: `60px`
- draw depth labels via `depthLabelsRenderer`
- draw horizontal gridlines via `gridRenderer`
- read `visibleDepthRange` from `viewStore` via a selector
- major interval: `100 m`
- minor interval: `10 m`

---

## Step 8 - DataTrack

Status: pending
Verification: GR track renders correctly and disappears cleanly outside data bounds
Commit: -

Implement `src/components/logview/DataTrack.tsx`.

```ts
interface DataTrackProps {
  config: TrackConfig;
  curves: CurveData[];
  width: number;
  height: number;
}
```

Requirements:

- draw order: clear -> grid -> curves
- clip to `visibleDepthRange + 10% buffer`
- use binary search on `depths`
- memoize scale computations with `useMemo`

---

## Step 9 - Track headers

Status: pending
Verification: GR header remains visible while tracks scroll
Commit: -

Implement:

- `src/components/logview/CurveScaleBar.tsx`
- `src/components/logview/TrackHeader.tsx`
- `src/components/logview/TrackHeaderRow.tsx`

Requirements:

- `CurveScaleBar` shows mnemonic, unit, and min/max scale bar
- `TrackHeader` is 80 px tall and stacks curve scale bars
- `TrackHeaderRow` uses `position: sticky; top: 0`

---

## Step 10 - LogViewPanel + synchronized scroll

Status: pending
Verification: all four tracks scroll together smoothly and remain within valid bounds
Commit: -

Implement:

- `src/hooks/useSynchronizedScroll.ts`
- `src/components/logview/LogViewPanel.tsx`
- default 4-track layout config (Depth, GR, ILD, RHOB)

Requirements:

- wheel -> depth delta -> `viewStore`
- no native browser scroll for the track area
- sticky header row
- all child tracks read shared scroll state from `viewStore`

---

## Out of Scope for Phase 1

| Feature | Phase |
|---|---|
| Formation top lines and dragging | 3 |
| Subsidence / burial history panel | 4 |
| Logarithmic grid rendering | 2 |
| Fill between curves | 2 |
| Reversed scale (NPHI) | 2 |
| Formation column (stratigraphy) | 2 |
| PropertyPanel, CurveBrowser | 3 |
| WebSocket + real-time recalculation | 4 |
| MD <-> TVD toggle | 5 |
| Export | 5 |

---

## Execution Order

```text
Step 1 (scaffold)
Step 2 (types)        <- can run parallel with Step 1 and Step 3
Step 3 (backend)
        v
Step 4 (stores)
        v
Step 5 (hooks)
        v
Step 6 (renderers)
        v
Step 7 (DepthTrack)
Step 8 (DataTrack)    <- Steps 7 and 8 can run in parallel
        v
Step 9 (headers)
        v
Step 10 (LogViewPanel + scroll)
```

---

## Definition of Done for Phase 1

- `npm run dev` + `uvicorn subsidence.api.main:app --reload` running simultaneously
- browser shows 4 tracks (Depth, GR, Resistivity, Porosity) with data from `sample.las`
- sticky track headers visible at all scroll positions
- mouse-wheel scrolls all tracks in sync at 60 fps with no visual artifacts
- `npx tsc --noEmit` reports zero type errors


