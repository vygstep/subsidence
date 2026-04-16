# Techlog-inspired well log visualization: architecture and implementation contract

**A Python subsidence calculator deserves a professional-grade web frontend.** This document specifies a modular, interactive well log visualization architecture modeled on Schlumberger Techlog's UI, designed to render petrophysical logs alongside subsidence/burial-history curves with full interactivity — draggable formation tops, click-to-select curves, and real-time recalculation. The architecture draws on patterns proven in Equinor's videx-wellog (the most sophisticated open-source well log renderer), combines a **hybrid Canvas + SVG rendering strategy** for performance and interactivity, and uses React 18, Zustand, and a FastAPI backend. Everything below is structured as an actionable implementation contract suitable for step-by-step execution in Claude Code.

---

## Repository status and starting assumptions

The GitHub repository at `https://github.com/vygstep/subsidence` is either private or not yet created — it could not be accessed publicly. This specification therefore assumes a **greenfield build** of a Python backend (subsidence calculations using NumPy/SciPy, well data via lasio) paired with a new React/TypeScript frontend. If existing Python code already handles backstripping, decompaction, or geohistory calculations, those modules slot directly into the FastAPI backend described below.

The architecture treats the Python layer as the computational engine and the browser as the interactive visualization surface. The key insight from studying every major open-source well log project is that **Equinor's videx-wellog uses a Track → Plot plugin pattern with Canvas rendering that outperforms all SVG-based alternatives** — we adopt this pattern while adding React wrappers, formation-top interactivity, and a linked subsidence-curve panel that no existing open-source project provides.

---

## Technology stack and why each piece was chosen

The stack balances rendering performance for dense scientific data with rich interactivity for geological interpretation workflows. **Canvas handles the data-heavy curve rendering** (thousands of depth-indexed points per curve across multiple tracks), while **SVG/HTML overlays manage interactive annotations** (formation tops, cursors, headers) that need native DOM events.

| Layer | Technology | Rationale |
|---|---|---|
| UI framework | React 18+ with TypeScript | Component composition, concurrent rendering, ecosystem |
| Data rendering | HTML5 Canvas (custom hooks) | 60fps with 10,000+ points per curve; immediate-mode avoids DOM bloat |
| Interactive overlays | visx (@visx/drag, @visx/scale, @visx/axis) | D3's math with React's declarative model; native SVG event handling |
| Scale/math | d3-scale, d3-array, d3-interpolate | Industry-standard axis calculation, logarithmic scale support |
| State management | Zustand | 1KB bundle; direct store access outside React for Canvas render loops; selective subscriptions prevent unnecessary re-renders |
| Backend | FastAPI (Python 3.11+) | Native async, WebSocket support, Pydantic validation, scientific Python ecosystem |
| Well data I/O | lasio, welly | LAS 2.0/3.0 parsing, curve mnemonic aliasing |
| Computation | NumPy, SciPy | Backstripping, decompaction, subsidence curve generation |
| Build tool | Vite | Fast HMR, native TypeScript, WebWorker bundling |
| Styling | Tailwind CSS + CSS Modules | Utility-first layout with scoped component styles |

**Why not use videx-wellog directly?** While videx-wellog is excellent, it is a vanilla TypeScript library without React integration, lacks formation-top dragging, and has no subsidence-curve panel. The webviz well-log-viewer wraps videx in React but is tightly coupled to Dash (Python dashboarding). Building custom components modeled on videx's architecture gives full control over the interaction model needed for subsidence workflows.

---

## Component architecture: the full decomposition

The component tree follows a strict hierarchy inspired by both Techlog's UI zones and videx-wellog's container → track → plot pattern. Every component has a single responsibility and communicates through Zustand stores or explicit props.

### Top-level layout

```
<App>
├── <AppHeader>                          // Well selector, depth scale, MD/TVD toggle, toolbar
├── <MainLayout>                         // CSS Grid: sidebar | log view | property panel
│   ├── <CurveBrowser>                   // Left sidebar: well tree + formation tops list
│   ├── <SplitView>                      // Resizable split between log view and subsidence
│   │   ├── <LogViewPanel>               // Well log display (vertical depth axis)
│   │   │   ├── <TrackHeaderRow>         // Sticky header strip
│   │   │   │   ├── <DepthTrackHeader>
│   │   │   │   └── <TrackHeader>[]      // One per data track
│   │   │   ├── <TrackCanvas>            // Scrollable data area
│   │   │   │   ├── <DepthTrack>         // Leftmost: depth labels + gridlines
│   │   │   │   ├── <DataTrack>[]        // One per log track (Canvas-rendered)
│   │   │   │   └── <FormationColumn>    // Rightmost: stratigraphy column
│   │   │   ├── <InteractionOverlay>     // SVG layer for formation tops + cursor
│   │   │   │   ├── <FormationTopLine>[] // Draggable horizontal lines
│   │   │   │   └── <DepthCursor>        // Mouse-following crosshair
│   │   │   └── <WellOverviewMinimap>    // Small full-well overview
│   │   └── <SubsidencePanel>            // Burial history / subsidence curves
│   │       ├── <SubsidenceHeader>       // Geological timescale bar
│   │       ├── <SubsidenceCanvas>       // Time (x) vs depth (y) plot
│   │       └── <SubsidenceControls>     // Overlay toggles, export
│   └── <PropertyPanel>                  // Right sidebar: selected element properties
└── <StatusBar>                          // Depth readout, cursor values, computation status
```

### The critical rendering pattern: Canvas data + SVG interaction

Each `<DataTrack>` renders curve data onto an offscreen Canvas via a custom `useCanvasRenderer` hook. A single transparent `<InteractionOverlay>` SVG element is positioned absolutely over all tracks. Formation top lines are SVG `<line>` elements inside this overlay — they receive native mouse events for dragging. This **layered architecture** means Canvas never needs hit-testing for annotation interactions, while curve selection uses a lightweight bounding-box check.

---

## Detailed component APIs and data models

### Core data types (TypeScript)

```typescript
// ── Well Data ──────────────────────────────────────────
interface Well {
  id: string;
  name: string;
  field?: string;
  location: { latitude: number; longitude: number };
  kb_elevation: number;           // Kelly Bushing elevation (m)
  total_depth: number;            // TD in meters
  curves: CurveData[];
  formations: FormationTop[];
}

interface CurveData {
  mnemonic: string;               // "GR", "ILD", "RHOB", "NPHI", "DT"
  unit: string;                   // "API", "ohm.m", "g/cc", "us/ft"
  description: string;
  depths: Float32Array;           // MD values
  values: Float32Array;           // Measurement values
  null_value: number;             // Sentinel for missing data (typically -999.25)
}

interface FormationTop {
  id: string;
  name: string;                   // "Wilcox", "Austin Chalk"
  depth_md: number;               // Measured depth (m)
  depth_tvd?: number;             // True vertical depth (m)
  age_ma?: number;                // Geological age in Ma
  color: string;                  // Hex color for display
  lithology?: LithologyType;
  is_locked: boolean;             // Prevent accidental dragging
}

type LithologyType = 'sandstone' | 'shale' | 'limestone' | 'dolomite'
  | 'evaporite' | 'igneous' | 'metamorphic' | 'coal' | 'conglomerate';

// ── Track Configuration ────────────────────────────────
interface TrackConfig {
  id: string;
  title: string;
  width: number;                  // Pixels (default 200, resizable)
  curves: CurveConfig[];
  scaleType: 'linear' | 'logarithmic';
  gridDivisions: number;          // 10 for linear, 4 decades for log
  showGrid: boolean;
}

interface CurveConfig {
  mnemonic: string;
  color: string;
  lineWidth: number;              // Default 1.5
  lineStyle: 'solid' | 'dashed' | 'dotted';
  scaleMin: number;
  scaleMax: number;
  scaleReversed: boolean;         // true for NPHI (45% → -15%)
  fill?: CurveFillConfig;
}

interface CurveFillConfig {
  type: 'to-baseline' | 'between-curves' | 'crossover';
  baseline?: number;              // For to-baseline fill
  pairedCurve?: string;           // Mnemonic of paired curve
  colorPositive: string;          // Fill color when curve > baseline/pair
  colorNegative: string;          // Fill color when curve < baseline/pair
  opacity: number;
}

// ── Subsidence Data ────────────────────────────────────
interface SubsidenceResult {
  formation_name: string;
  color: string;
  lithology: LithologyType;
  // Each point: age (Ma) → depth (m) through geological time
  burial_path: { age_ma: number; depth_m: number }[];
}

interface SubsidenceInput {
  formations: {
    name: string;
    top_depth: number;            // Current depth (m)
    base_depth: number;
    age_top_ma: number;           // Age of formation top
    age_base_ma: number;          // Age of formation base
    lithology: LithologyType;
    porosity_surface?: number;    // Surface porosity for decompaction
    compaction_coefficient?: number;
  }[];
  water_depth_history?: { age_ma: number; depth_m: number }[];
  sea_level_curve?: 'haq87' | 'miller05' | 'custom';
}

// ── Layout Template ────────────────────────────────────
interface LayoutTemplate {
  id: string;
  name: string;
  tracks: TrackConfig[];
  depthRange: { min: number; max: number };
  depthScale: number;             // Pixels per meter (e.g., 5 = 1:200)
  depthType: 'MD' | 'TVD';
}
```

### Zustand store architecture

Three stores enforce separation between data, view state, and computed results. This prevents expensive re-renders when only the scroll position changes.

```typescript
// ── Store 1: Well Data (rarely changes) ────────────────
interface WellDataStore {
  well: Well | null;
  formations: FormationTop[];
  layout: LayoutTemplate;
  // Actions
  loadWell: (wellId: string) => Promise<void>;
  updateFormationDepth: (id: string, newDepth: number) => void;
  addFormation: (top: FormationTop) => void;
  removeFormation: (id: string) => void;
  updateLayout: (layout: Partial<LayoutTemplate>) => void;
}

// ── Store 2: View State (changes frequently) ───────────
interface ViewStore {
  scrollY: number;                // Current scroll offset in pixels
  zoomLevel: number;              // Depth scale multiplier
  visibleDepthRange: { min: number; max: number };
  selectedElementId: string | null;
  selectedElementType: 'curve' | 'track' | 'formation' | null;
  cursorDepth: number | null;     // Depth at mouse position
  isDragging: boolean;
  trackWidths: Record<string, number>;
  splitRatio: number;             // LogView vs SubsidenceView split (0-1)
  // Actions
  setScroll: (y: number) => void;
  setZoom: (level: number) => void;
  selectElement: (id: string, type: string) => void;
  clearSelection: () => void;
  setTrackWidth: (trackId: string, width: number) => void;
}

// ── Store 3: Computed/Derived Data ─────────────────────
interface ComputedStore {
  subsidenceCurves: SubsidenceResult[];
  isComputing: boolean;
  computeError: string | null;
  lastComputeTime: number;
  // Actions
  triggerRecalculation: () => void;
  setResults: (results: SubsidenceResult[]) => void;
}
```

### Key component specifications

**`<DataTrack>`** — The workhorse Canvas-rendered track component:

```typescript
interface DataTrackProps {
  config: TrackConfig;
  curves: CurveData[];            // Actual data arrays for curves in this track
  visibleRange: { min: number; max: number };  // Depth range to render
  depthScale: number;             // px/meter
  width: number;
  height: number;
  isSelected: boolean;
  onCurveClick?: (mnemonic: string, depth: number) => void;
}
```

Internally uses a `useCanvasRenderer` hook that: (1) clips curve data to the visible depth range + 10% buffer, (2) transforms depth → pixel-y and value → pixel-x using d3-scale, (3) draws gridlines, then curves, then fills in a single `requestAnimationFrame` pass, (4) caches the rendered bitmap via `ImageBitmap` when data hasn't changed.

**`<FormationTopLine>`** — SVG draggable line spanning all tracks:

```typescript
interface FormationTopLineProps {
  formation: FormationTop;
  yPosition: number;              // Pixel position (computed from depth + scroll)
  totalWidth: number;             // Full width across all tracks
  onDragStart: () => void;
  onDrag: (newDepth: number) => void;
  onDragEnd: (finalDepth: number) => void;
}
```

Uses `@visx/drag` for drag behavior. On `onDragEnd`, dispatches `wellDataStore.updateFormationDepth()` which triggers a debounced (300ms) `computedStore.triggerRecalculation()`. During drag, only the SVG line position updates (60fps); the Canvas tracks do not re-render until drag ends.

**`<SubsidenceCanvas>`** — Burial history / geohistory plot:

```typescript
interface SubsidencePanelProps {
  subsidenceCurves: SubsidenceResult[];
  formations: FormationTop[];
  timeRange: { min_ma: number; max_ma: number };
  depthRange: { min: number; max: number };
  showOverlays: { maturity: boolean; temperature: boolean };
}
```

Renders with the **x-axis as geological time** (oldest left, present right) and **y-axis as depth** (zero top, increasing downward). Formation curves track their burial paths through time. Colored fills between adjacent formation curves show stratigraphic units. This panel **shares the depth axis** with the LogView — when a formation top is dragged in the log view, the corresponding burial curve endpoint updates in real time.

---

## Frontend–backend communication architecture

```
React Frontend                          FastAPI Backend
─────────────────                       ──────────────────
GET /api/wells/{id}         ────→       Load well from LAS/database
  ← JSON { well, curves, formations }

GET /api/wells/{id}/curves   ────→      Server-side LOD downsampling
  ?depth_min=X&depth_max=Y              (LTTB algorithm)
  &resolution=Z
  ← JSON { curves: CurveData[] }

PUT /api/wells/{id}/formations ──→      Persist formation edits
  { formations: FormationTop[] }

WS /ws/recalculate           ←→        Real-time subsidence calc
  → { formations, parameters }          NumPy/SciPy backstripping
  ← { status: "computing", progress }   Decompaction
  ← { status: "complete", results }     Returns SubsidenceResult[]
```

**REST** handles initial data loading and persistence. **WebSocket** handles the real-time recalculation loop triggered by formation-top dragging. The WebSocket approach is essential because subsidence calculations involve decompaction and backstripping across all formations simultaneously — computation takes **200–2000ms** depending on complexity, and streaming progress back prevents the UI from feeling frozen.

### Backend API specification (FastAPI)

```python
# ── main.py ─────────────────────────────────────────────
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel

app = FastAPI(title="Subsidence API")

class WellResponse(BaseModel):
    id: str
    name: str
    curves: list[CurveResponse]
    formations: list[FormationTopResponse]

class SubsidenceRequest(BaseModel):
    formations: list[FormationInput]
    water_depth_history: list[DepthTimePoint] | None
    sea_level_curve: str = "haq87"

@app.get("/api/wells/{well_id}")
async def get_well(well_id: str) -> WellResponse: ...

@app.get("/api/wells/{well_id}/curves")
async def get_curves(well_id: str, depth_min: float, 
                     depth_max: float, resolution: int) -> CurveListResponse: ...

@app.put("/api/wells/{well_id}/formations")
async def update_formations(well_id: str, 
                            formations: list[FormationTopInput]): ...

@app.websocket("/ws/recalculate")
async def recalculate(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_json()
        # Run backstripping computation
        results = await compute_subsidence(data)
        await websocket.send_json({"status": "complete", "results": results})
```

---

## File structure for the complete project

```
subsidence/
├── backend/
│   ├── main.py                          # FastAPI app entry point
│   ├── requirements.txt                 # fastapi, uvicorn, lasio, numpy, scipy, welly
│   ├── api/
│   │   ├── __init__.py
│   │   ├── wells.py                     # Well CRUD endpoints
│   │   ├── curves.py                    # Curve data endpoints with LOD
│   │   ├── formations.py               # Formation top endpoints
│   │   └── websocket.py                # WebSocket recalculation handler
│   ├── models/
│   │   ├── __init__.py
│   │   ├── well.py                      # Pydantic models: Well, CurveData
│   │   ├── formation.py                 # FormationTop, SubsidenceInput
│   │   └── subsidence.py               # SubsidenceResult, BackstripParams
│   ├── services/
│   │   ├── __init__.py
│   │   ├── well_loader.py              # LAS/DLIS file loading via lasio/welly
│   │   ├── curve_processor.py          # Downsampling (LTTB), unit conversion
│   │   ├── subsidence_calculator.py    # Core: backstripping, decompaction
│   │   └── compaction_models.py        # Athy, Sclater-Christie, Baldwin-Butler
│   └── data/                            # Sample LAS files for development
│       └── sample_well.las
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   │   └── lithology-patterns/          # SVG patterns for sandstone, shale, etc.
│   ├── src/
│   │   ├── main.tsx                     # React entry point
│   │   ├── App.tsx                      # Root layout with CSS Grid
│   │   │
│   │   ├── stores/                      # Zustand stores
│   │   │   ├── wellDataStore.ts         # Well data, formations, layout
│   │   │   ├── viewStore.ts             # Scroll, zoom, selection, cursor
│   │   │   └── computedStore.ts         # Subsidence results, computation state
│   │   │
│   │   ├── types/                       # TypeScript interfaces
│   │   │   ├── well.ts                  # Well, CurveData, FormationTop
│   │   │   ├── tracks.ts               # TrackConfig, CurveConfig, CurveFill
│   │   │   ├── subsidence.ts           # SubsidenceResult, SubsidenceInput
│   │   │   └── layout.ts               # LayoutTemplate
│   │   │
│   │   ├── api/                         # Backend communication
│   │   │   ├── wellApi.ts               # REST endpoints (fetch wrapper)
│   │   │   └── subsidenceSocket.ts      # WebSocket client for recalculation
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppHeader.tsx         # Well selector, scale control, toolbar
│   │   │   │   ├── MainLayout.tsx        # CSS Grid: sidebar | content | props
│   │   │   │   ├── SplitView.tsx         # Resizable split (log | subsidence)
│   │   │   │   └── StatusBar.tsx         # Depth readout, computation status
│   │   │   │
│   │   │   ├── sidebar/
│   │   │   │   ├── CurveBrowser.tsx      # Tree: Well → Dataset → Curve
│   │   │   │   ├── FormationTopsList.tsx # List of formations with add/delete
│   │   │   │   └── PropertyPanel.tsx     # Selected element properties editor
│   │   │   │
│   │   │   ├── logview/                 # ── WELL LOG DISPLAY ──
│   │   │   │   ├── LogViewPanel.tsx      # Container: headers + tracks + overlay
│   │   │   │   ├── TrackHeaderRow.tsx    # Sticky header strip (flex row)
│   │   │   │   ├── TrackHeader.tsx       # Single track header with scale bars
│   │   │   │   ├── CurveScaleBar.tsx     # Min/max + color + line style indicator
│   │   │   │   ├── DepthTrack.tsx        # Depth labels + horizontal gridlines
│   │   │   │   ├── DataTrack.tsx         # Canvas-rendered curve track
│   │   │   │   ├── FormationColumn.tsx   # Stratigraphy column (blocks + labels)
│   │   │   │   └── WellOverviewMinimap.tsx
│   │   │   │
│   │   │   ├── interaction/             # ── SVG OVERLAY LAYER ──
│   │   │   │   ├── InteractionOverlay.tsx # Parent SVG spanning all tracks
│   │   │   │   ├── FormationTopLine.tsx   # Draggable horizontal line + label
│   │   │   │   ├── DepthCursor.tsx        # Mouse-following crosshair + readout
│   │   │   │   └── CurveTooltip.tsx       # Hover tooltip showing curve values
│   │   │   │
│   │   │   └── subsidence/              # ── SUBSIDENCE PANEL ──
│   │   │       ├── SubsidencePanel.tsx    # Container for burial history plot
│   │   │       ├── SubsidenceCanvas.tsx   # Canvas: time vs depth curves
│   │   │       ├── GeologicalTimescale.tsx # Colored period/epoch bar (top axis)
│   │   │       └── SubsidenceControls.tsx # Overlay toggles, export button
│   │   │
│   │   ├── hooks/                       # Custom React hooks
│   │   │   ├── useCanvasRenderer.ts     # Core: manages Canvas lifecycle + rendering
│   │   │   ├── useDepthScale.ts         # d3 scale: depth ↔ pixel conversion
│   │   │   ├── useValueScale.ts         # d3 scale: curve value ↔ pixel (lin/log)
│   │   │   ├── useSynchronizedScroll.ts # Shared scroll offset across tracks
│   │   │   ├── useFormationDrag.ts      # visx/drag wrapper for formation tops
│   │   │   ├── useWebSocket.ts          # WebSocket connection + reconnection
│   │   │   └── useVisibleRange.ts       # Compute visible depth from scroll + zoom
│   │   │
│   │   ├── renderers/                   # Canvas drawing functions (pure)
│   │   │   ├── curveRenderer.ts         # Draw a single curve line on Canvas
│   │   │   ├── fillRenderer.ts          # Area fills, crossover detection
│   │   │   ├── gridRenderer.ts          # Linear + logarithmic gridlines
│   │   │   ├── depthLabelsRenderer.ts   # Depth tick labels
│   │   │   └── lithologyRenderer.ts     # Pattern fills for stratigraphy column
│   │   │
│   │   ├── utils/
│   │   │   ├── dataClipping.ts          # Clip curve data to visible range
│   │   │   ├── lttbDownsample.ts        # Largest-Triangle-Three-Buckets
│   │   │   ├── depthTransform.ts        # MD ↔ TVD interpolation
│   │   │   ├── colorPalettes.ts         # Standard curve colors, formation colors
│   │   │   └── geologicalTimescale.ts   # Period/epoch definitions with colors
│   │   │
│   │   └── styles/
│   │       ├── globals.css
│   │       ├── tracks.module.css
│   │       └── panels.module.css
│   │
│   └── tests/
│       ├── renderers/
│       │   └── curveRenderer.test.ts
│       └── stores/
│           └── wellDataStore.test.ts
│
├── docker-compose.yml                   # Backend + frontend dev setup
└── README.md
```

---

## How the rendering pipeline actually works

Understanding the rendering flow is critical for implementation. Each frame follows this sequence for the log view:

**Step 1 — Scroll/zoom event** fires on the `<LogViewPanel>` container. The `useSynchronizedScroll` hook captures `onWheel`, computes the new scroll offset, and writes it to `viewStore.scrollY`. All tracks share this single source of truth.

**Step 2 — Visible range computation.** The `useVisibleRange` hook derives `{ min: topDepth, max: bottomDepth }` from `scrollY`, `zoomLevel`, and the panel's pixel height. This fires only when the depth window actually changes (Zustand selective subscription).

**Step 3 — Data clipping.** Each `<DataTrack>` calls `dataClipping.clipToRange(curveData, visibleRange)` to extract only the points within the viewport plus a 10% buffer. This is a binary search on the sorted depth array — **O(log n)** per curve.

**Step 4 — Canvas draw pass.** The `useCanvasRenderer` hook executes in a `requestAnimationFrame` callback. For each track, it: clears the canvas, draws gridlines via `gridRenderer`, iterates each curve calling `curveRenderer.drawCurve(ctx, clippedData, xScale, yScale)`, then applies fills via `fillRenderer`. The entire pass for a 5-track display with 6 curves typically completes in **<2ms** on modern hardware.

**Step 5 — SVG overlay update.** React re-renders `<FormationTopLine>` components with updated y-positions derived from `depth → pixel` via the shared depth scale. Because these are SVG elements (not Canvas), React's virtual DOM diffing handles updates efficiently.

**Step 6 — Subsidence panel sync.** The `<SubsidenceCanvas>` shares formation data with the log view. When a formation top's depth changes, both panels reflect the update. The subsidence panel uses its own Canvas renderer but subscribes to the same `wellDataStore.formations` slice.

---

## Formation top dragging and real-time recalculation flow

This is the core interactive workflow that distinguishes this app from static log plotters. The sequence handles the complete lifecycle from mouse-down to updated subsidence curves:

1. User **mousedown** on a `<FormationTopLine>` SVG element. `useFormationDrag` (wrapping `@visx/drag`) captures the event and sets `viewStore.isDragging = true`.

2. **During drag** (mousemove): The SVG line's y-position updates at 60fps via React state. A throttled callback (every 16ms) converts pixel-y back to depth using the inverse depth scale and updates a *local* draft depth. The Canvas tracks do **not** re-render during drag — only the SVG overlay moves. This keeps the interaction buttery smooth.

3. **On mouseup** (drag end): `wellDataStore.updateFormationDepth(id, finalDepth)` commits the new depth. This triggers a Zustand `subscribe` callback that calls `computedStore.triggerRecalculation()` after a **300ms debounce** (prevents rapid-fire recalcs if user makes multiple quick adjustments).

4. **Recalculation**: The `subsidenceSocket.ts` WebSocket client sends the updated formation data to `ws://localhost:8000/ws/recalculate`. The Python backend runs the backstripping algorithm (decompact each formation, compute tectonic subsidence, generate burial paths). Progress updates stream back.

5. **Result display**: `computedStore.setResults(newCurves)` updates the store. The `<SubsidenceCanvas>` re-renders with new burial curves. **Total latency from drag-end to updated plot: 300ms debounce + 200–1000ms computation = 500–1300ms** — fast enough for interactive interpretation.

---

## Standard track configurations following industry conventions

The default layout follows the **API 5-track standard** adapted from Techlog conventions. Every color, scale range, and grid type below is industry-standard and should be the default template:

| Track | Title | Curves | Scale range | Scale type | Grid | Colors |
|---|---|---|---|---|---|---|
| 0 | Depth | MD (TVD optional) | Auto | — | Major: 100m, Minor: 10m | Black labels |
| 1 | Gamma Ray | GR: 0–150 API | Linear | 10 divisions | GR: **green** solid |
| 1 | (overlay) | CALI: 6–16 in | Linear | — | CALI: black dashed |
| 2 | Resistivity | ILD: 0.2–2000 Ω·m | Logarithmic | 4 decades | ILD: **red**; ILM: blue; SFL: green |
| 3 | Porosity | RHOB: 1.95–2.95 g/cc | Linear | 10 divisions | RHOB: **red** solid |
| 3 | (overlay) | NPHI: 0.45–(−0.15) | Linear (reversed) | — | NPHI: blue dashed |
| 4 | Sonic | DT: 140–40 μs/ft | Linear | 10 divisions | DT: **blue** solid |
| 5 | Formation | Stratigraphy | — | — | Colored blocks + lithology patterns |

**Track headers** stack one row per curve showing: mnemonic, units, [min ←——→ max] scale bar, line style + color swatch. Double-clicking a header opens the property editor. Right-clicking shows a context menu (add curve, change scale, delete).

**Curve fills**: The density-neutron track should default to crossover fill — yellow when NPHI > RHOB (gas indicator), grey when NPHI < RHOB. The GR track optionally fills left of a shale baseline (GR=75 API) in sand-yellow, right in grey-green.

---

## Phased implementation roadmap

### Phase 1: Foundation (Week 1–2)

**Goal**: Render static well log curves from a LAS file in the browser.

| Task | Files | Acceptance criteria |
|---|---|---|
| Set up Vite + React + TypeScript project | `frontend/` scaffold | `npm run dev` serves blank app |
| Set up FastAPI backend with lasio | `backend/main.py`, `well_loader.py` | `GET /api/wells/sample` returns parsed LAS data as JSON |
| Define all TypeScript types | `types/*.ts` | All interfaces from spec above compile |
| Create Zustand stores (data + view) | `stores/*.ts` | Stores initialize, can load well data from API |
| Build `<DepthTrack>` with Canvas | `DepthTrack.tsx`, `depthLabelsRenderer.ts` | Renders depth labels at correct intervals |
| Build `<DataTrack>` with single curve | `DataTrack.tsx`, `curveRenderer.ts`, `useCanvasRenderer.ts` | Renders GR curve with correct scale |
| Build `<TrackHeader>` + `<CurveScaleBar>` | `TrackHeader.tsx`, `CurveScaleBar.tsx` | Shows mnemonic, units, min/max, color |
| Build `<LogViewPanel>` layout | `LogViewPanel.tsx`, `TrackHeaderRow.tsx` | 3 tracks side-by-side with sticky headers |
| Implement synchronized scrolling | `useSynchronizedScroll.ts` | Mouse wheel scrolls all tracks simultaneously |

### Phase 2: Multi-curve tracks and grids (Week 3)

**Goal**: Multiple curves per track, linear + logarithmic grids, curve fills.

| Task | Files | Acceptance criteria |
|---|---|---|
| Multi-curve rendering in DataTrack | `DataTrack.tsx` update | Overlay GR + CALI in Track 1; RHOB + NPHI in Track 3 |
| Logarithmic grid + scale | `gridRenderer.ts`, `useValueScale.ts` | Resistivity track renders 4-decade log grid |
| Reversed scale support | `useValueScale.ts` | NPHI renders right-to-left (reversed) |
| Area fills between curves | `fillRenderer.ts` | Crossover fill on density-neutron track |
| GR baseline fill | `fillRenderer.ts` | GR shading left/right of cutoff line |
| `<FormationColumn>` with blocks | `FormationColumn.tsx`, `lithologyRenderer.ts` | Colored blocks with formation names + lithology patterns |
| Depth scale presets | `AppHeader.tsx` | Dropdown: 1:200, 1:500, 1:1000 changes zoom |
| Track resizing via drag | `DataTrack.tsx`, `viewStore.ts` | Drag border between tracks to resize width |

### Phase 3: Interactivity (Week 4–5)

**Goal**: Formation top picking, dragging, curve selection, property panel.

| Task | Files | Acceptance criteria |
|---|---|---|
| `<InteractionOverlay>` SVG layer | `InteractionOverlay.tsx` | Transparent SVG covers all tracks |
| `<FormationTopLine>` rendering | `FormationTopLine.tsx` | Dashed horizontal lines with labels at correct depths |
| Formation top dragging | `useFormationDrag.ts`, visx/drag | Drag line up/down, depth updates on release |
| `<DepthCursor>` crosshair | `DepthCursor.tsx` | Horizontal line follows mouse; shows depth in StatusBar |
| `<CurveTooltip>` on hover | `CurveTooltip.tsx` | Shows all curve values at cursor depth |
| Curve click-to-select | `DataTrack.tsx` hit detection | Click near curve highlights it (thicker line, glow) |
| `<PropertyPanel>` for selected items | `PropertyPanel.tsx` | Edit color, scale, line style for selected curve |
| `<CurveBrowser>` sidebar | `CurveBrowser.tsx` | Tree view of available curves; drag to add to track |
| Right-click context menus | Per-component | Track: add/delete curve; Curve: change properties; Top: rename/delete |
| `<WellOverviewMinimap>` | `WellOverviewMinimap.tsx` | Small-scale full-well view showing viewport rectangle |

### Phase 4: Subsidence integration (Week 6–7)

**Goal**: Linked subsidence panel with real-time recalculation.

| Task | Files | Acceptance criteria |
|---|---|---|
| `subsidence_calculator.py` backend | `services/subsidence_calculator.py` | Airy backstripping with Athy decompaction |
| `compaction_models.py` | `services/compaction_models.py` | Athy, Sclater-Christie porosity-depth models |
| WebSocket recalculation endpoint | `api/websocket.py` | Accepts formation data, returns burial paths |
| `<SubsidencePanel>` layout | `SubsidencePanel.tsx` | Time (x) vs depth (y) with correct axis orientation |
| `<SubsidenceCanvas>` rendering | `SubsidenceCanvas.tsx` | Burial curves + colored formation fills |
| `<GeologicalTimescale>` bar | `GeologicalTimescale.tsx` | ICS-colored period/epoch bar along top axis |
| Wire drag → recalculate → display | `subsidenceSocket.ts`, stores | Dragging a formation top updates subsidence curves in <1.5s |
| `<SplitView>` resizable panels | `SplitView.tsx` | Log view left, subsidence right, draggable divider |
| Depth axis synchronization | Shared `viewStore` | Clicking a depth in either panel highlights it in both |

### Phase 5: Polish and export (Week 8)

**Goal**: Production-quality UX, templates, export, performance.

| Task | Files | Acceptance criteria |
|---|---|---|
| Layout template save/load | `layout.ts`, API endpoints | Save current track config as JSON; apply to other wells |
| PNG/SVG export | Export utility | Full-resolution well log + subsidence export |
| Performance optimization | `lttbDownsample.ts`, LOD endpoint | Server-side LTTB downsampling; <2ms Canvas frame time |
| MD ↔ TVD toggle | `depthTransform.ts` | Toggle renders all tracks in TVD using deviation survey |
| Keyboard shortcuts | Global handler | Ctrl+Z undo formation move; +/- zoom; arrow scroll |
| Dark/light theme | CSS variables | Toggle between light (print-like) and dark themes |
| Responsive layout | CSS Grid breakpoints | Works on 1920px down to 1280px; tablets in simplified mode |

---

## Implementation contract for Claude Code

The following is a step-by-step instruction set designed to be fed directly to Claude in VS Code for implementation. Each step is atomic, testable, and builds on the previous one.

### Contract preamble

```
PROJECT: Subsidence Well Log Viewer
STACK: React 18 + TypeScript + Vite (frontend), FastAPI + Python 3.11 (backend)
KEY LIBRARIES: zustand, @visx/drag, @visx/scale, @visx/axis, d3-scale, d3-array
RENDERING: HTML5 Canvas for data tracks, SVG overlay for interactive elements
ARCHITECTURE: Modular components following Track → Curve plugin pattern
FILE STRUCTURE: See specification above — follow it exactly
STYLE: Tailwind CSS for layout, CSS Modules for component-specific styles
CONVENTIONS: Functional components only, custom hooks for all reusable logic,
  pure functions in renderers/ directory, all state in Zustand stores
```

### Step 1 — Project scaffold

```
Create both frontend/ and backend/ directories with:

FRONTEND:
- npm create vite@latest frontend -- --template react-ts
- Install: zustand, @visx/drag, @visx/scale, @visx/axis, @visx/shape,
  d3-scale, d3-array, d3-interpolate, tailwindcss, @types/d3-scale
- Configure tsconfig.json with strict mode, paths alias "@/" → "src/"
- Create the complete directory structure under src/ as specified
- Create placeholder index.ts barrel exports in each directory

BACKEND:
- Create requirements.txt: fastapi, uvicorn[standard], lasio, numpy, scipy,
  welly, pydantic, websockets, python-multipart
- Create main.py with CORS middleware allowing localhost:5173
- Create empty module files matching the backend/ structure specified

TEST: `npm run dev` serves React app; `uvicorn main:app --reload` serves API
```

### Step 2 — Type definitions and stores

```
Implement ALL TypeScript interfaces from the specification above in:
- src/types/well.ts (Well, CurveData, FormationTop, LithologyType)
- src/types/tracks.ts (TrackConfig, CurveConfig, CurveFillConfig)
- src/types/subsidence.ts (SubsidenceResult, SubsidenceInput)
- src/types/layout.ts (LayoutTemplate)

Then implement Zustand stores:
- src/stores/wellDataStore.ts — with loadWell (fetches from API), 
  updateFormationDepth, addFormation, removeFormation
- src/stores/viewStore.ts — with setScroll, setZoom, selectElement,
  clearSelection, setTrackWidth
- src/stores/computedStore.ts — with triggerRecalculation, setResults

Each store should use zustand's create() with the exact interface specified.
wellDataStore.loadWell should fetch from GET /api/wells/{id} and populate state.

TEST: Import stores in App.tsx, log initial state to console.
```

### Step 3 — Backend well data endpoint

```
Implement backend/services/well_loader.py:
- Function load_well_from_las(filepath: str) -> dict that uses lasio to parse
  a LAS file and returns well metadata + curve data
- Convert curve data to lists of floats (JSON-serializable)
- Extract well name, location, depth range from LAS header

Implement backend/api/wells.py:
- GET /api/wells/{well_id} endpoint
- For now, load a sample LAS file from backend/data/
- Return WellResponse matching the frontend Well type

Include a sample LAS file in backend/data/ (use a public domain Volve dataset
file or generate synthetic data with: GR, ILD, RHOB, NPHI, DT curves,
depth range 1000-4000m, 0.1524m sampling).

Implement backend/api/curves.py:
- GET /api/wells/{well_id}/curves?depth_min=X&depth_max=Y&resolution=Z
- Implement LTTB (Largest-Triangle-Three-Buckets) downsampling
- Return only requested depth range at requested resolution

TEST: curl http://localhost:8000/api/wells/sample returns valid JSON with curves.
```

### Step 4 — Canvas rendering hooks and core renderers

```
Implement src/hooks/useCanvasRenderer.ts:
- Takes a ref to HTMLCanvasElement and a draw callback
- Handles: devicePixelRatio scaling, resize observer, requestAnimationFrame loop
- Only redraws when dependencies change (use a dirty flag)
- Returns { canvasRef, setDirty }

Implement src/hooks/useDepthScale.ts:
- Creates a d3.scaleLinear() mapping depth range → pixel range
- Inputs: visibleDepthRange, canvasHeight
- Returns: { depthToPixel, pixelToDepth, scale }

Implement src/hooks/useValueScale.ts:
- Creates d3.scaleLinear() or d3.scaleLog() based on scaleType
- Handles reversed scales (for NPHI)
- Inputs: scaleMin, scaleMax, trackWidth, scaleType, reversed
- Returns: { valueToPixel, pixelToValue, scale }

Implement src/renderers/gridRenderer.ts:
- drawLinearGrid(ctx, xScale, yScale, divisions, color)
- drawLogarithmicGrid(ctx, xScale, yScale, decades, color)
- drawDepthGridlines(ctx, depthScale, width, majorInterval, minorInterval)
Pure functions that take a CanvasRenderingContext2D and draw directly.

Implement src/renderers/curveRenderer.ts:
- drawCurve(ctx, depths, values, depthScale, valueScale, style)
- Handles null values (gaps in the line)
- Uses Path2D for efficient drawing
- Single beginPath() per curve for performance

TEST: Create a test component that renders a single Canvas with a sine wave
using useCanvasRenderer + curveRenderer. Verify it displays correctly.
```

### Step 5 — DepthTrack and DataTrack components

```
Implement src/components/logview/DepthTrack.tsx:
- Fixed width (60px)
- Canvas-rendered depth labels (every major interval)
- Horizontal gridlines extending full width
- Uses useCanvasRenderer + depthLabelsRenderer
- Reads visibleDepthRange from viewStore

Implement src/components/logview/DataTrack.tsx:
- Props: TrackConfig, CurveData[], width, height
- Uses useCanvasRenderer for the main drawing loop
- Draw sequence: clear → grid → fills → curves (back to front)
- Each curve uses its own CurveConfig for color, scale, style
- Subscribes to viewStore.visibleDepthRange via Zustand selector
- Memoize scale computations with useMemo

Implement src/renderers/fillRenderer.ts:
- drawFillBetweenCurves(ctx, curve1Data, curve2Data, depthScale, 
  valueScale1, valueScale2, colorPositive, colorNegative, opacity)
- Handles crossover detection: walk depth samples, detect where curves cross,
  switch fill color at crossing points
- drawFillToBaseline(ctx, curveData, baseline, depthScale, valueScale,
  colorAbove, colorBelow)

TEST: Render a DataTrack with GR curve (green, 0-150 API, linear).
Verify curve renders at correct position with correct scale.
```

### Step 6 — LogViewPanel with multi-track layout

```
Implement src/components/logview/TrackHeader.tsx:
- Renders one header per track with stacked CurveScaleBar components
- Fixed height (80px), same width as corresponding DataTrack

Implement src/components/logview/CurveScaleBar.tsx:
- Shows: curve mnemonic, units, min←→max scale bar, color+style indicator
- Compact layout: fits in ~25px height per curve

Implement src/components/logview/TrackHeaderRow.tsx:
- Flex row of TrackHeader components
- position: sticky; top: 0 for fixed headers during scroll

Implement src/components/logview/LogViewPanel.tsx:
- Outer container with overflow-y: hidden
- TrackHeaderRow at top (sticky)
- Scrollable area containing: DepthTrack + DataTrack[] side by side
- Capture onWheel events → update viewStore.scrollY
- All child tracks read scroll from store (no prop drilling)

Implement src/hooks/useSynchronizedScroll.ts:
- Captures wheel events on the panel container
- Converts deltaY to depth offset based on current zoom
- Clamps to valid depth range
- Writes to viewStore.setScroll()

Create default layout template with 5 tracks (GR, Resistivity, 
Density-Neutron, Sonic, Formation) using the standard config table above.

TEST: Load sample well data, display 4 data tracks + depth track with
synchronized scrolling. All tracks scroll together smoothly at 60fps.
```

### Step 7 — Formation tops and interaction overlay

```
Implement src/components/interaction/InteractionOverlay.tsx:
- SVG element with position: absolute, covering all tracks
- pointer-events: none on the SVG itself
- pointer-events: auto on interactive child elements (formation lines)
- z-index above Canvas tracks

Implement src/components/interaction/FormationTopLine.tsx:
- SVG group containing: horizontal line + text label
- Line spans full width of all tracks
- Label positioned at left edge with background rect for readability  
- Dashed line style with formation-specific color
- pointer-events: auto for mouse interaction

Implement src/hooks/useFormationDrag.ts:
- Wraps @visx/drag to handle formation top dragging
- On drag start: set viewStore.isDragging = true, highlight the line
- During drag: update local y-position (NOT the store) at 60fps
- On drag end: convert pixel-y → depth, call wellDataStore.updateFormationDepth
- Prevent dragging past adjacent formation tops (maintains order)
- Support locked formations (is_locked = true prevents drag)

Implement src/components/interaction/DepthCursor.tsx:
- Thin horizontal line following mouse y-position
- Shows depth value label at the left edge
- Reads mouse position from onMouseMove on InteractionOverlay
- Updates viewStore.cursorDepth for StatusBar display

TEST: Display 3 formation tops. Drag one up/down — it moves smoothly.
On release, the store updates with new depth. Cursor crosshair follows mouse.
```

### Step 8 — Subsidence calculation backend

```
Implement backend/services/compaction_models.py:
- athy_porosity(depth, phi0, c): φ = φ0 * exp(-c * z)
- sclater_christie_porosity(depth, phi0, c): same model, different defaults
- decompact_thickness(current_top, current_base, target_top, phi0, c):
  Iteratively solve for decompacted thickness using Newton-Raphson

Implement backend/services/subsidence_calculator.py:
- backstrip(formations: list[FormationInput]) -> list[SubsidenceResult]:
  1. Sort formations by age (oldest first)
  2. For each time step (each formation top age):
     a. Decompact all formations that exist at that time
     b. Calculate total sediment load
     c. Apply Airy isostatic correction
     d. Compute tectonic subsidence = total - sediment loading
  3. Return burial paths for each formation
- Generate burial_path arrays: [{age_ma, depth_m}, ...] for each formation

Implement backend/api/websocket.py:
- WebSocket endpoint at /ws/recalculate
- Receives: { formations: [...], parameters: {...} }
- Runs backstrip() computation
- Sends progress updates: { status: "computing", progress: 0.0-1.0 }
- Sends results: { status: "complete", results: SubsidenceResult[] }

TEST: Send test formation data via WebSocket → receive burial paths.
Verify decompaction produces thicker (deeper) formations in the past.
```

### Step 9 — Subsidence panel with linked display

```
Implement src/components/subsidence/SubsidenceCanvas.tsx:
- Canvas-rendered burial history plot
- X-axis: geological time (Ma), oldest left, 0 (present) right
- Y-axis: depth (m), 0 at top, increasing downward
- Draw formation burial curves as colored lines
- Fill between adjacent curves with formation colors
- Uses useCanvasRenderer + custom subsidence renderers

Implement src/components/subsidence/GeologicalTimescale.tsx:
- Colored horizontal bar at top showing geological periods/epochs
- Based on ICS International Chronostratigraphic Chart colors
- Rendered as HTML/CSS (not Canvas) for crisp text

Implement src/components/subsidence/SubsidencePanel.tsx:
- Container with header (timescale) + canvas + controls
- Subscribes to computedStore.subsidenceCurves
- Shows loading spinner during computation

Implement src/api/subsidenceSocket.ts:
- WebSocket client connecting to ws://localhost:8000/ws/recalculate
- Auto-reconnect on disconnect
- Exposes: sendRecalculation(input: SubsidenceInput)
- Dispatches results to computedStore.setResults()

Wire the drag → recalculate flow:
- wellDataStore.updateFormationDepth triggers subscribe callback
- Debounced (300ms) call to subsidenceSocket.sendRecalculation()
- Results arrive → computedStore.setResults() → SubsidenceCanvas re-renders

Implement src/components/layout/SplitView.tsx:
- Resizable horizontal split: LogViewPanel (left) | SubsidencePanel (right)
- Draggable divider bar
- Stores split ratio in viewStore.splitRatio

TEST: Drag a formation top in the log view → subsidence curves update
in the right panel within 1.5 seconds. Verify burial curves make
geological sense (deeper burial in the past for older formations).
```

### Step 10 — Property panel, curve browser, polish

```
Implement src/components/sidebar/PropertyPanel.tsx:
- Reads viewStore.selectedElementId and selectedElementType
- If curve selected: show color picker, line style dropdown, scale inputs
- If formation selected: show name editor, depth input, color, lock toggle
- If track selected: show track title, scale type toggle, grid settings
- All changes dispatch to wellDataStore or trigger layout update

Implement src/components/sidebar/CurveBrowser.tsx:
- Tree structure: Well name → [list of curve mnemonics]
- Each curve shows: mnemonic, unit, min/max of data
- Drag a curve from browser → drop on a DataTrack to add it
- Or click "+" on a track header to open curve selection dialog

Implement src/components/sidebar/FormationTopsList.tsx:
- List of all formation tops with depth, name, color dot
- "Add" button to create new formation at cursor depth
- "Delete" button per formation (with confirmation)
- Click to scroll log view to that formation's depth

Implement src/components/logview/WellOverviewMinimap.tsx:
- Small (40px wide) strip showing the full well depth range
- Viewport rectangle shows current visible range
- Click/drag on minimap to navigate

Implement src/components/layout/StatusBar.tsx:
- Shows: cursor depth, curve values at cursor depth, computation status
- Reads cursorDepth from viewStore
- For each visible curve, interpolates value at cursor depth

Add keyboard shortcuts:
- Ctrl+Z: undo last formation move (maintain undo stack in wellDataStore)
- +/-: zoom in/out
- Arrow up/down: scroll
- Escape: clear selection
- Delete: remove selected formation top

TEST: Full integration test — load well, scroll, zoom, select curve
(highlight changes), drag formation, see subsidence update, edit
properties in panel, verify all UI elements respond correctly.
```

---

## Performance targets and optimization checklist

Every implementation step should be tested against these benchmarks:

- **Canvas frame time**: <2ms per frame for a 5-track, 8-curve display at 1080p
- **Scroll smoothness**: Consistent **60fps** during mouse-wheel scrolling (no dropped frames)
- **Formation drag latency**: SVG line follows mouse with **<16ms** lag (single frame)
- **Recalculation round-trip**: Drag-end to updated subsidence plot in **<1500ms** (including 300ms debounce)
- **Initial load**: Well with 20,000 depth samples loads and renders in **<2 seconds**
- **Memory**: <100MB for a single well with 10 curves at full resolution

Key optimizations baked into the architecture: Canvas renders only visible depth range (viewport clipping), Float32Array for numeric data, ImageBitmap caching for unchanged curves, LTTB server-side downsampling at coarse zoom levels, Zustand selective subscriptions preventing unnecessary React re-renders, and separated stores so scroll updates (60fps) never trigger data-layer re-renders.

---

## Conclusion: what makes this architecture work

Three architectural decisions set this design apart from existing open-source well log viewers. First, the **layered Canvas + SVG rendering** solves the fundamental tension between dense data performance and rich annotation interactivity — no single rendering technology handles both well, but layering them eliminates the compromise. Second, the **three-store Zustand pattern** (data / view / computed) ensures that high-frequency UI events like scrolling never cascade into expensive data operations, while still enabling reactive updates when formation tops change. Third, the **WebSocket-based recalculation pipeline** bridges the frontend interaction model with Python's scientific computing ecosystem, enabling real-time geological interpretation workflows that previously required desktop software like Techlog or PetroMod.

The phased roadmap deliberately front-loads the rendering foundation (Phases 1–2) before adding interactivity (Phase 3) and computation (Phase 4). This ensures each phase produces a testable, visually verifiable artifact. By Phase 4's end, the core value proposition — drag a formation top and watch subsidence curves recalculate — is fully operational. Phase 5 adds production polish without changing the architecture.