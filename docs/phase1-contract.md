# Phase 1: Foundation вЂ” Implementation Contract

**Goal**: Render static well log curves from a LAS file in the browser with synchronized scrolling across all tracks. No calculations yet.

---

## Task checklist

Each step ends with a `вњ“` verification task. Do not move to the next step until the verification passes.

### Step 1 вЂ” Frontend scaffold
- [x] 1.1 Run `npm create vite@latest frontend -- --template react-ts`
- [x] 1.2 Install deps: `zustand d3-scale d3-array tailwindcss @types/d3-scale @types/d3-array`
- [x] 1.3 Configure `vite.config.ts`: proxy `/api` в†’ `localhost:8000`
- [x] 1.4 Configure `tsconfig.json`: strict mode + paths alias `@/` в†’ `src/`
- [x] 1.5 Create full `src/` directory tree + empty `index.ts` barrel files
- [x] 1.вњ“ **Verify**: `npm run dev` serves blank app with no console errors
### Step 2 вЂ” TypeScript types
- [ ] 2.1 Write `src/types/well.ts`: `Well`, `CurveData`, `FormationTop`, `LithologyType`
- [ ] 2.2 Write `src/types/tracks.ts`: `TrackConfig`, `CurveConfig`
- [ ] 2.вњ“ **Verify**: `npx tsc --noEmit` passes with zero errors

### Step 3 вЂ” FastAPI well data endpoint
- [ ] 3.1 Add sample LAS file to `app/data/sample.las`
- [ ] 3.2 Add CORS middleware to `app/src/subsidence/api/main.py`
- [ ] 3.3 Write `app/src/subsidence/api/wells.py`: `GET /api/wells/sample`
- [ ] 3.4 Wire `wells.py` to existing `loaders.load_las_curves()`
- [ ] 3.вњ“ **Verify**: `curl http://localhost:8000/api/wells/sample` returns JSON with at least one curve

### Step 4 вЂ” Zustand stores
- [ ] 4.1 Write `src/stores/wellDataStore.ts` with `loadWell` (fetch + Float32Array conversion)
- [ ] 4.2 Write `src/stores/viewStore.ts` with `scrollDepth`, `depthPerPixel`, `visibleDepthRange`
- [ ] 4.вњ“ **Verify**: `loadWell("sample")` logs curves as `Float32Array` in browser console

### Step 5 вЂ” Canvas hooks
- [ ] 5.1 Write `src/hooks/useCanvasRenderer.ts`: RAF + `devicePixelRatio` + `ResizeObserver`
- [ ] 5.2 Write `src/hooks/useDepthScale.ts`: d3 `scaleLinear` depth в†’ pixel-Y
- [ ] 5.3 Write `src/hooks/useValueScale.ts`: d3 `scaleLinear`/`scaleLog`, reversed support
- [ ] 5.вњ“ **Verify**: test component renders sine wave; no flicker on window resize

### Step 6 вЂ” Renderers (pure functions)
- [ ] 6.1 Write `src/renderers/gridRenderer.ts`: `drawLinearGrid` + `drawDepthGridlines`
- [ ] 6.2 Write `src/renderers/curveRenderer.ts`: `drawCurve` with `Path2D`, null gap handling
- [ ] 6.3 Write `src/renderers/depthLabelsRenderer.ts`: `drawDepthLabels`
- [ ] 6.вњ“ **Verify**: renderers have zero React imports; callable as plain functions

### Step 7 вЂ” DepthTrack
- [ ] 7.1 Write `src/components/logview/DepthTrack.tsx`: 60 px wide, depth labels + gridlines
- [ ] 7.вњ“ **Verify**: at `scrollDepth=1000`, labels 1000 m, 1100 m, 1200 mвЂ¦ appear at correct pixel positions

### Step 8 вЂ” DataTrack
- [ ] 8.1 Write `src/components/logview/DataTrack.tsx`: Canvas, binary-search clip, draw loop
- [ ] 8.вњ“ **Verify**: GR (green, 0вЂ“150 API) renders correctly; no crash when scrolling past data end

### Step 9 вЂ” Track headers
- [ ] 9.1 Write `src/components/logview/CurveScaleBar.tsx`: mnemonic + unit + colour bar
- [ ] 9.2 Write `src/components/logview/TrackHeader.tsx`: 80 px tall, stacked `CurveScaleBar`s
- [ ] 9.3 Write `src/components/logview/TrackHeaderRow.tsx`: `position: sticky; top: 0` flex row
- [ ] 9.вњ“ **Verify**: GR header reads `GR / API / 0 в†ђвЂ”вЂ”в†’ 150` in green and stays visible while track area scrolls

### Step 1 вЂ” Frontend scaffold
- [x] 1.1 Run `npm create vite@latest frontend -- --template react-ts`
- [x] 1.2 Install deps: `zustand d3-scale d3-array tailwindcss @types/d3-scale @types/d3-array`
- [x] 1.3 Configure `vite.config.ts`: proxy `/api` в†’ `localhost:8000`
- [x] 1.4 Configure `tsconfig.json`: strict mode + paths alias `@/` в†’ `src/`
- [x] 1.5 Create full `src/` directory tree + empty `index.ts` barrel files
- [x] 1.вњ“ **Verify**: `npm run dev` serves blank app with no console errors
### Step 2 вЂ” TypeScript types

**`src/types/well.ts`** вЂ” field names in `snake_case` to match the Python models:

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

**`src/types/tracks.ts`** вЂ” exactly as in app_compass.md:

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

**Acceptance criteria:** `npx tsc --noEmit` passes with zero errors.

---

### Step 3 вЂ” FastAPI: well data endpoint

**`app/src/subsidence/api/main.py`** вЂ” add CORS + mount the wells router:
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], ...)
app.include_router(wells_router, prefix="/api")
```

**`app/src/subsidence/api/wells.py`** вЂ” one endpoint:
```
GET /api/wells/sample
```

Response shape (matching TypeScript `Well` + `CurveData[]`):
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

Data source: place a sample LAS file at `app/data/sample.las` (Volve public dataset or a generated synthetic well). Parse via existing `loaders.load_las_curves()`. No database вЂ” single hardcoded well for now.

**Acceptance criteria:** `curl http://localhost:8000/api/wells/sample` returns valid JSON with at least one curve.

---

### Step 4 вЂ” Zustand stores

**`src/stores/wellDataStore.ts`:**
```ts
interface WellDataStore {
  well: Well | null;
  curves: CurveData[];          // all curves for the loaded well
  formations: FormationTop[];
  isLoading: boolean;
  error: string | null;
  loadWell: (wellId: string) => Promise<void>;
}
```
`loadWell` fetches `GET /api/wells/{id}`, converts plain number arrays в†’ `Float32Array`.

**`src/stores/viewStore.ts`:**
```ts
interface ViewStore {
  scrollDepth: number;                         // depth at top of viewport (metres)
  depthPerPixel: number;                       // scale: m/px  (default 0.2 = 1:200)
  visibleDepthRange: { min: number; max: number };
  cursorDepth: number | null;
  trackWidths: Record<string, number>;
  setScroll: (depth: number) => void;
  setScale: (dpp: number) => void;
  setCursorDepth: (depth: number | null) => void;
}
```
`visibleDepthRange` is a derived value вЂ” recomputed whenever `scrollDepth`, `depthPerPixel`, or viewport height changes.

**Acceptance criteria:** Call `loadWell("sample")` from `App.tsx`, log the result вЂ” curves appear in the console as `Float32Array`.

---

### Step 5 вЂ” Canvas hooks

**`src/hooks/useCanvasRenderer.ts`:**
```ts
function useCanvasRenderer(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  deps: unknown[]
): React.RefObject<HTMLCanvasElement>
```
Handles: `devicePixelRatio` scaling, `ResizeObserver`, `requestAnimationFrame`. Redraws only when `deps` change.

**`src/hooks/useDepthScale.ts`:**
d3 `scaleLinear` mapping `visibleDepthRange` в†’ `[0, canvasHeight]`. Returns `{ depthToPixel, pixelToDepth, scale }`.

**`src/hooks/useValueScale.ts`:**
d3 `scaleLinear` or `scaleLog` mapping `[scaleMin, scaleMax]` в†’ `[0, trackWidth]`. Supports `reversed: true` (for NPHI). Returns `{ valueToPixel, pixelToValue, scale }`.

**Acceptance criteria:** A throwaway test component renders a sine wave via `useCanvasRenderer`. The wave is visible and does not flicker on window resize.

---

### Step 6 вЂ” Renderers (pure functions, no React)

**`src/renderers/gridRenderer.ts`:**
```ts
drawLinearGrid(ctx, xScale, divisions, width, height, color): void
drawDepthGridlines(ctx, depthScale, width, majorInterval, minorInterval): void
```

**`src/renderers/curveRenderer.ts`:**
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
- Skips `null_value` segments (breaks the line вЂ” no gap-filling)
- Uses `Path2D` for efficient drawing
- Single `beginPath()` per continuous segment

**`src/renderers/depthLabelsRenderer.ts`:**
```ts
drawDepthLabels(ctx, depthScale, width, majorInterval): void
```

**Acceptance criteria:** All functions are side-effect free вЂ” they only accept `ctx` + data and draw. No React imports, no store access.

---

### Step 7 вЂ” DepthTrack

**`src/components/logview/DepthTrack.tsx`:**
- Fixed width: `60px`
- Canvas: depth labels via `depthLabelsRenderer`, horizontal gridlines via `gridRenderer`
- Reads `visibleDepthRange` from `viewStore` via a selector (not the entire store)
- Major interval: 100 m вЂ” Minor interval: 10 m

**Acceptance criteria:** With `scrollDepth=1000` and `depthPerPixel=0.2`, depth labels 1000 m, 1100 m, 1200 m вЂ¦ are displayed at the correct pixel positions.

---

### Step 8 вЂ” DataTrack

**`src/components/logview/DataTrack.tsx`:**

```ts
interface DataTrackProps {
  config: TrackConfig;
  curves: CurveData[];
  width: number;
  height: number;
}
```

Draw order per frame: `clear в†’ grid в†’ curves (back-to-front by config order)`.

Data clipping: binary search on `depths` to extract only points within `visibleDepthRange + 10% buffer` вЂ” O(log n) per curve.

Scale computations memoized with `useMemo`.

**Acceptance criteria:** GR track (green, 0вЂ“150 API, linear) renders correctly. Scrolling past the end of data makes the curve disappear cleanly вЂ” no crash, no artifact.

---

### Step 9 вЂ” TrackHeader + CurveScaleBar

**`src/components/logview/CurveScaleBar.tsx`:**
- Height: ~24 px per curve
- Displays: `mnemonic`, `unit`, a `min в†ђвЂ”вЂ”в†’ max` bar filled with the curve colour

**`src/components/logview/TrackHeader.tsx`:**
- Height: 80 px, width = track width
- Stack of `CurveScaleBar` components (one per curve in the track)
- Track title label at top

**`src/components/logview/TrackHeaderRow.tsx`:**
- `position: sticky; top: 0; z-index: 10`
- Flex row of `TrackHeader` components, one per track

**Acceptance criteria:** Headers remain visible while the track area scrolls. The GR header reads `GR / API / 0 в†ђвЂ”вЂ”в†’ 150` in green.

---

### Step 10 вЂ” LogViewPanel + synchronized scroll

**`src/hooks/useSynchronizedScroll.ts`:**
```ts
// Attaches onWheel to the panel container
// Converts deltaY (px) в†’ depth delta (m) using depthPerPixel
// Clamps result to [minDepth, maxDepth]
// Writes to viewStore.setScroll()
```

**`src/components/logview/LogViewPanel.tsx`:**
- `overflow: hidden` вЂ” no native browser scroll
- `TrackHeaderRow` at top (sticky)
- Horizontal flex row: `DepthTrack` + `DataTrack[]`
- `onWheel` в†’ `useSynchronizedScroll`
- All child tracks read scroll position from `viewStore` вЂ” no prop drilling

**Default 4-track layout** (industry-standard configuration):

| # | Title | Curve | Colour | Range | Scale |
|---|---|---|---|---|---|
| 0 | Depth | вЂ” | вЂ” | auto | вЂ” |
| 1 | Gamma Ray | GR | `#22c55e` green | 0вЂ“150 API | linear |
| 2 | Resistivity | ILD | `#ef4444` red | 0.2вЂ“2000 О©В·m | logarithmic |
| 3 | Porosity | RHOB | `#ef4444` red | 1.95вЂ“2.95 g/cc | linear |

**Acceptance criteria:** All 4 tracks scroll together smoothly on mouse-wheel. Headers do not scroll. Scrolling stays within valid depth range. No dropped frames at 60 fps.

---

## Out of scope for Phase 1

| Feature | Phase |
|---|---|
| Formation top lines and dragging | 3 |
| Subsidence / burial history panel | 4 |
| Logarithmic grid rendering | 2 |
| Fill between curves (crossover, baseline) | 2 |
| Reversed scale (NPHI) | 2 |
| Formation column (stratigraphy) | 2 |
| PropertyPanel, CurveBrowser | 3 |
| WebSocket + real-time recalculation | 4 |
| MD в†” TVD toggle | 5 |
| Export | 5 |

---

## Execution order

```
Step 1 (scaffold)
Step 2 (types)       в†ђ can run parallel with Step 1 and Step 3
Step 3 (backend)
        в†“
Step 4 (stores)
        в†“
Step 5 (hooks)
        в†“
Step 6 (renderers)
        в†“
Step 7 (DepthTrack)
Step 8 (DataTrack)   в†ђ Steps 7 and 8 can run in parallel
        в†“
Step 9 (headers)
        в†“
Step 10 (LogViewPanel + scroll)
```

Steps 1вЂ“3 are independent of each other. Step 4 requires both Step 2 (types) and Step 3 (working API). Steps 5вЂ“10 are strictly sequential.

---

## Definition of done for Phase 1

- `npm run dev` + `uvicorn subsidence.api.main:app --reload` running simultaneously
- Browser shows 4 tracks (Depth, GR, Resistivity, Porosity) with data from `sample.las`
- Sticky track headers visible at all scroll positions
- Mouse-wheel scrolls all tracks in sync, 60 fps, no visual artifacts
- `npx tsc --noEmit` вЂ” zero type errors



