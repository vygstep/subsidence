# Phase 4: Subsidence Integration — Burial History and Real-Time Recalculation

**Goal**: Connect formation tops, lithology, and age data to the core subsidence computation
engine. A user who has picked and aged formation tops in the log viewer can activate the
subsidence panel, see burial curves rendered on a geological time axis, and drag formation tops
to watch the curves recalculate in real time. This phase delivers the core scientific value
proposition of the application: an interactive well-log viewer that is simultaneously a
geohistory workbench.

The rendering architecture from Phase 3 (Canvas data + SVG interaction + Zustand stores) is
preserved. Phase 4 adds a third panel — `SubsidencePanel` — linked to the log viewer through
shared formation state and driven by a WebSocket computation pipeline on the FastAPI backend.

**Status**: Complete. Audited 2026-04-22.

---

## Progress

| Step | Status | Verification | Commit |
|---|---|---|---|
| Step 1  | ✅ done | `GET /api/lithology-params` returns 9 rows with φ₀ and c; `PATCH` updates a row; values survive server restart | `f54d0b6` |
| Step 2  | ✅ done | `POST /api/wells/{id}/subsidence` returns burial paths; unit tests pass; decompaction numerically stable | `9b538af` |
| Step 3  | ✅ done | `computedStore` initializes; REST → WebSocket path both land results in store | `3b05d38` |
| Step 4  | ✅ done | Log view and subsidence panel side by side; divider draggable; split ratio persists | `3b05d38` |
| Step 5  | ✅ done | Burial curves render at correct geological ages; ICS timescale bar shows period bands | `b2d94f2` |
| Step 6  | ✅ done | Drag a formation top → subsidence curves update via debounced recalculation | `cd5d3b3` |
| Step 7  | ✅ done | WebSocket replaces REST; "Computing…" overlay; auto-reconnects after backend restart | `df75ce6` |
| Step 8  | ✅ done | Multi-model compaction editor; built-in + user models; changing φ₀ → curves update | `cf31f9f` |
| Step 9  | ✅ done | LTTB LOD endpoint; `fetchCurvesLOD` in wellDataStore; LOD fires on zoom threshold | `9d8bb24` |
| Step 10 | ✅ done | MD/TVD toggle in depth track settings; depth track, formations, status bar all switch | `1e49778` |

### Post-step fixes (2026-04-21 – 2026-04-22)

| Fix | Description | Commit |
|---|---|---|
| Depth track settings inspector | Depth reference selector moved into depth track settings panel | `112967f` |
| TVD always enabled | Vertical well fallback (TVD = MD) when no deviation survey | `075fa0a` |
| Track header depth label | Depth track header shows reactive MD/TVD label from viewStore | `8b62e79` |
| Formations track inspector | FormationsTrack settings in SettingsInspector | `a1fedeb` |
| Bug fix: age derivation | Conformable tops derive age_base_ma from next pick; unconformity hiatus handled | `838b85e` |
| Bug fix: strat auto-link | Auto-link copies age_top_ma from StratUnit to FormationTopModel | `838b85e` |
| Bug fix: panel header | SubsidenceCanvas (and GeologicalTimescale) always visible, not gated on curves | `838b85e` |
| Timescale alignment | GeologicalTimescale uses CSS flex + percentage layout; aligns with canvas PADDING | `48379a6` |

---

## Historical Task Checklist

This checklist is retained as the original implementation spec.
Current truth source for completion is the Progress table above plus the post-step fixes table.

### Step 1 — Compaction parameters: schema + API

- [x] 1.1 Add three columns to `LithologyDictEntry` in `app/src/subsidence/data/schema.py`:
          `density: Mapped[float]` (kg/m³, grain density),
          `porosity_surface: Mapped[float]` (φ₀, fraction 0–1),
          `compaction_coeff: Mapped[float]` (c, km⁻¹ — stored in km⁻¹, converted to m⁻¹ in engine)
          All `Float`, non-nullable, with application-level server defaults so existing DB rows
          that were seeded without these columns are updated on next `seed_dictionaries()` call
- [x] 1.2 Update the lithology seed CSV (checked via `dict_seeder.py`) to include `density`,
          `porosity_surface`, and `compaction_coeff` for all 9 lithology codes; use standard
          Athy model values (see spec table); these must match the parameter naming used by
          `repos/pybasin/lib/pybasin_lib.py` after unit conversion (pyBasin expects c in m⁻¹)
- [x] 1.3 Write `app/src/subsidence/api/compaction.py`:
          `GET /api/lithology-params` → `list[LithologyParamItem]`
          `PATCH /api/lithology-params/{lithology_code}` body `{ density?, porosity_surface?, compaction_coeff? }`
- [x] 1.4 Register `compaction` router in `app/src/subsidence/api/main.py`
- [x] 1.5 Verify: `GET /api/lithology-params` returns all 9 rows with density, φ₀, c; `PATCH`
          updates shale φ₀ to 0.70; server restart → value persists

### Step 2 — Backstripping engine backend

- [x] 2.1 Write `app/src/subsidence/data/backstrip.py` wrapping the existing engine in
          `repos/pybasin/lib/pybasin_lib.py`; do **not** rewrite the decompaction math — import
          `integrate_porosity`, `calculate_matrix_thickness`, and `compact` directly
          (they depend only on `numpy`, no external deps); unit-convert c: DB stores km⁻¹,
          pyBasin expects m⁻¹ → `c_m = c_km / 1000.0`
- [x] 2.2 `backstrip.py` public surface:
          `backstrip(formations, litho_params, water_depth_m=0.0) → list[SubsidenceResult]`
          where `formations` is a list of `FormationInput` dataclasses and `litho_params` is a
          `dict[str, LithologyParam]` read from DB
- [x] 2.3 The backstripping loop follows the Stratya2D algorithm pattern
          (`repos/Stratya2D/backstripping.py`): at each time step, strip younger formations,
          iteratively decompact remaining column from basement upward using `compact()`, then
          apply Airy correction; use per-lithology density from `litho_params` for the isostatic
          correction instead of a fixed ρ_s (ρ_m=3330, ρ_w=1030 matching pyBacktrack `well.py`)
- [x] 2.4 Write `app/src/subsidence/api/subsidence.py`:
          `POST /api/wells/{well_id}/subsidence` reads current formations + compaction params from
          DB, calls `backstrip()`, returns `list[SubsidenceResultResponse]`;
          returns `400` if fewer than 2 formations have both ages assigned
- [x] 2.5 Register `subsidence` router in `app/src/subsidence/api/main.py` under `/api`
- [x] 2.6 Write unit tests in `tests/unit/test_backstrip.py` using a 2-formation shale column:
          verify pyBasin's `compact()` is called (not a re-implementation); verify decompacted
          paleo-thickness > present thickness; verify tectonic subsidence is positive and finite
- [x] 2.7 Verify: `POST /api/wells/{id}/subsidence` with a well that has 3 aged formations
          returns 3 `SubsidenceResult` items; each `burial_path` has length ≥ 2 and depths
          increase monotonically toward the present

### Step 3 — Frontend types + computedStore

- [x] 3.1 Write `frontend/src/types/subsidence.ts`:
          `SubsidenceResult`, `SubsidenceInput`, `BurialPoint` (see spec)
- [x] 3.2 Write `frontend/src/stores/computedStore.ts`: `subsidenceCurves`, `isComputing`,
          `computeError`, `lastComputeTime`, `triggerRecalculation()`, `setResults()`, `clearResults()`
- [x] 3.3 `triggerRecalculation()` initial implementation: calls `POST /api/wells/{id}/subsidence`
          via fetch, sets `isComputing` during the request, calls `setResults` on success
- [x] 3.4 Export `useComputedStore` from `frontend/src/stores/index.ts`
- [x] 3.5 Verify: call `useComputedStore.getState().triggerRecalculation()` from browser console
          with a project that has aged formations → `subsidenceCurves` is populated, `isComputing`
          transitions false → true → false

### Step 4 — SplitView resizable layout

- [x] 4.1 Write `frontend/src/components/layout/SplitView.tsx`: horizontal resizable container;
          left pane (log view), right pane (subsidence panel); draggable `<div>` divider bar (6 px)
- [x] 4.2 Add `splitRatio: number` (default 0.55) and `setSplitRatio(r: number)` to `viewStore.ts`
- [x] 4.3 Divider drag updates `viewStore.splitRatio`; clamp to `[0.2, 0.8]`;
          changes are debounced (300 ms) into `projectStore.saveVisualConfig({ splitRatio })`
- [x] 4.4 Update `App.tsx` (or `MainLayout`): replace bare `<LogViewPanel>` with `<SplitView>`;
          right pane renders `<SubsidencePanel>` (stub acceptable in Step 4)
- [x] 4.5 `visual_config` PATCH endpoint in backend must accept and return `splitRatio`
- [x] 4.6 Export `SplitView` from `frontend/src/components/layout/index.ts`
- [x] 4.7 Verify: drag divider left → log view narrows, subsidence pane widens; close + reopen →
          split ratio preserved

### Step 5 — SubsidenceCanvas + GeologicalTimescale

- [x] 5.1 Write `frontend/src/utils/geologicalTimescale.ts`: typed array of ICS period records
          covering the Phanerozoic (see spec); exported as `GEOLOGIC_PERIODS`
- [x] 5.2 Write `frontend/src/components/subsidence/GeologicalTimescale.tsx`: CSS-rendered
          horizontal bar (40 px tall); each period a colored block with label clipped to block width;
          time axis: oldest left, present right; `timeRange` prop sets min/max Ma
- [x] 5.3 Write `frontend/src/renderers/subsidenceRenderer.ts`:
          `drawBurialCurves(ctx, curves, timeScale, depthScale, width, height): void`
          `drawFormationFills(ctx, curves, timeScale, depthScale, width, height): void`
          (see spec for axis orientation and fill logic)
- [x] 5.4 Write `frontend/src/components/subsidence/SubsidenceCanvas.tsx`: Canvas-rendered burial
          history; x-axis = time (Ma, oldest left), y-axis = depth (m, 0 at top); reads
          `computedStore.subsidenceCurves`; uses `useCanvasRenderer`
- [x] 5.5 Write `frontend/src/components/subsidence/SubsidenceControls.tsx` (stub): empty `<div>`
          with class `subsidence-controls`; expand in Step 8
- [x] 5.6 Write `frontend/src/components/subsidence/SubsidencePanel.tsx`: container with
          `GeologicalTimescale` at top + `SubsidenceCanvas` filling remaining height;
          `SubsidenceControls` at bottom; shows loading overlay when `isComputing`; shows
          `"No data — formation ages required"` empty state
- [x] 5.7 Export all subsidence components from
          `frontend/src/components/subsidence/index.ts` (new file)
- [x] 5.8 Verify: manually call `computedStore.setResults([...])` with mock data → burial curves
          appear in `SubsidenceCanvas`; `GeologicalTimescale` shows Jurassic-to-present when
          `timeRange = { min_ma: 0, max_ma: 201 }`

### Step 6 — Formation drag → debounced REST recalculation

- [x] 6.1 In `wellDataStore.ts`, after a successful `updateFormationDepth` debounced PATCH,
          call `useComputedStore.getState().triggerRecalculation()` via dynamic import (same
          pattern as the existing `pollStatus()` call)
- [x] 6.2 Also trigger on `addFormation` success and `removeFormation` success
- [x] 6.3 `triggerRecalculation()` must be idempotent: if a request is already in flight, cancel
          the previous one (`AbortController`) and start a new one
- [x] 6.4 Verify: with 3 aged formations, drag a top 100 m → within 1.5 s burial curves update
          in `SubsidenceCanvas`; `StatusBar` shows `"Computing…"` during the request then clears

### Step 7 — WebSocket recalculation pipeline

- [x] 7.1 Write `app/src/subsidence/api/subsidence.py`: add
          `WebSocket /ws/recalculate` endpoint; accepts JSON `{ well_id }`, reads formations +
          compaction params from DB, sends `{ status: "computing", progress: 0.0 }`, runs
          `backstrip()`, sends `{ status: "complete", results: [...] }`
- [x] 7.2 Write `frontend/src/hooks/useWebSocket.ts`: generic hook managing one WebSocket
          connection with auto-reconnect (exponential backoff, max 30 s); exposes `send(data)`,
          `readyState`, and `onMessage` callback
- [x] 7.3 Write `frontend/src/api/subsidenceSocket.ts`:
          `sendRecalculation(wellId: string): void`
          Returns results via `computedStore.setResults`; progress updates `isComputing = true`
- [x] 7.4 Replace fetch call in `computedStore.triggerRecalculation()` with
          `subsidenceSocket.sendRecalculation(wellId)` (WebSocket path)
- [x] 7.5 `SubsidencePanel` loading overlay: show while `isComputing === true`; display
          `computeError` if not null (red inline message, not a toast)
- [x] 7.6 Verify: drag a formation top → WebSocket message sent → "Computing…" overlay appears →
          curves update on `"complete"` message; kill and restart the backend → client reconnects
          automatically and next drag triggers recalculation normally

### Step 8 — Compaction parameters editor UI

- [x] 8.1 Extend `frontend/src/stores/wellDataStore.ts` (or a new `projectWideStore`): add
          `lithologyParams: LithologyParam[]`, `loadLithologyParams(): Promise<void>`,
          `updateLithologyParam(code, patch): Promise<void>` — calls `PATCH /api/lithology-params/{code}`
- [x] 8.2 Call `loadLithologyParams()` on project open (after `loadWell`)
- [x] 8.3 Add `'compaction'` as a selectable object type in the left `Data Manager` tree: static
          node labeled `"Compaction params"` under a `"Models"` section
- [x] 8.4 Extend `SettingsInspector.tsx` with a `compaction-params` branch: renders a table of
          all 9 lithology codes with editable `<input type="number" step="0.01">` for φ₀ and c;
          on blur, call `updateLithologyParam(code, { porosity_surface, compaction_coeff })`
- [x] 8.5 After a successful `PATCH`, call `computedStore.triggerRecalculation()` so curves
          update immediately
- [x] 8.6 Verify: change shale φ₀ from 0.63 to 0.80 → curves update; refresh page → value 0.80
          is retained; change back to 0.63 → curves update again

### Step 9 — LTTB server-side LOD + curve mnemonic defaults

- [x] 9.1 Write `app/src/subsidence/data/lttb.py`: pure Python `lttb(times, values, threshold)`
          implementing the Largest-Triangle-Three-Buckets algorithm; return indices of retained
          samples
- [x] 9.2 Add `GET /api/wells/{well_id}/curves` with query params `depth_min`, `depth_max`,
          `resolution` (max points per curve); clips curve data to depth window then runs LTTB;
          returns same `CurveResponse` shape as the full `GET /api/wells/{id}` curves
- [x] 9.3 In `frontend/src/stores/wellDataStore.ts`, add `fetchCurvesLOD(depthMin, depthMax,
          resolution)` which calls the new endpoint and merges results into the loaded `curves`
          array without clearing formations or well metadata
- [x] 9.4 Add a `useEffect` in `LogViewPanel.tsx` (or `App.tsx`) that fires when `depthPerPixel`
          crosses a coarseness threshold (e.g., `> 1.0 m/px`): call `fetchCurvesLOD` with the
          current visible depth range + `resolution = Math.ceil(viewportHeight / 2)`
- [x] 9.5 Extend `SettingsInspector` curve branch: add a `"Defaults"` row that reads the matching
          `CurveDictEntry` (family, canonical unit) from `GET /api/curve-dict?mnemonic={m}` and
          shows a `"Apply defaults"` button that resets color, scaleMin, scaleMax to family defaults
- [x] 9.6 Verify: load a well with 30 000 depth samples; zoom to a 200 m window → LOD fetch
          replaces curve with ≤ `viewportHeight / 2` points; Canvas frame time stays < 2 ms;
          zoom back out → full-resolution data present

### Step 10 — MD ↔ TVD depth toggle

- [x] 10.1 Write `frontend/src/utils/depthTransform.ts`: `minCurvatureToTVD(survey: SurveyPoint[])
           → TVDTable` and `mdToTvd(md: number, table: TVDTable) → number` using minimum curvature
           interpolation; `SurveyPoint = { md, inclination_deg, azimuth_deg }`
- [x] 10.2 Add `depthType: 'MD' | 'TVD'` (default `'MD'`) and `setDepthType(t)` to `viewStore.ts`
- [x] 10.3 Add a `"TVD"` toggle button to `ProjectToolbar.tsx` (second row, always visible when a
           well with deviation data is loaded); disabled + tooltip `"No deviation survey"` when none
- [x] 10.4 `wellDataStore.ts` must store the computed TVD table after `loadWell()` when deviation
           data exist; expose `tvdTable: TVDTable | null`
- [x] 10.5 `DepthTrack.tsx`: when `depthType === 'TVD'`, convert `scrollDepth`/labels via
           `mdToTvd`; render tick labels as TVD values
- [x] 10.6 `FormationTopLine.tsx` and `FormationColumn.tsx`: when `depthType === 'TVD'`, convert
           `formation.depth_md` to TVD for the y-position calculation only; store always holds MD
- [x] 10.7 `StatusBar.tsx` depth readout: show `MD {d} m` or `TVD {d} m` based on `depthType`
- [x] 10.8 `SubsidenceCanvas.tsx` depth axis: convert burial path depths to TVD when toggle is on
- [x] 10.9 Verify: toggle TVD on for a deviated well (inclination 20°) → depth track shows
           shallower TVD labels; formation lines shift proportionally; toggle back → MD restored;
           undulating toggle does not cause visual drift (precision stable)

---

## Detailed step specifications

### Step 1 — Compaction parameters: schema + API

Status: done
Verification: 9-row response with density/φ₀/c; PATCH persists across restart
Commit: —

**Schema additions to `LithologyDictEntry`:**

```python
class LithologyDictEntry(Base):
    # existing fields unchanged …
    density: Mapped[float] = mapped_column(Float, default=2650.0)
    # grain density in kg/m³ — used for per-lithology Airy isostatic correction
    # matches the parameter in pyBacktrack's Lithology(density, surface_porosity, porosity_decay)
    porosity_surface: Mapped[float] = mapped_column(Float, default=0.50)
    # φ₀, unitless fraction (0–1)
    compaction_coeff: Mapped[float] = mapped_column(Float, default=0.30)
    # c in km⁻¹; engine converts to m⁻¹ via c_m = c_km / 1000.0 before calling pyBasin functions
```

**Default values per lithology code:**

Sources: Allen & Allen (2005), Sclater & Christie (1980), pyBacktrack lithology dictionary.
`density` values are grain (matrix) densities, not bulk densities.

| lithology_code | density (kg/m³) | φ₀   | c (km⁻¹) |
|---|---|---|---|
| sandstone      | 2650 | 0.49 | 0.27 |
| shale          | 2720 | 0.63 | 0.51 |
| limestone      | 2710 | 0.50 | 0.60 |
| dolomite       | 2870 | 0.40 | 0.50 |
| evaporite      | 2960 | 0.10 | 0.10 |
| coal           | 1400 | 0.55 | 0.40 |
| conglomerate   | 2650 | 0.45 | 0.25 |
| igneous        | 2900 | 0.01 | 0.01 |
| metamorphic    | 2800 | 0.01 | 0.01 |

**Pydantic models:**

```python
class LithologyParamItem(BaseModel):
    lithology_code: str
    display_name: str
    color_hex: str
    density: float                 # grain density, kg/m³
    porosity_surface: float        # φ₀, fraction (0–1)
    compaction_coeff: float        # c, km⁻¹

class LithologyParamPatch(BaseModel):
    density: float | None = None
    porosity_surface: float | None = None
    compaction_coeff: float | None = None
```

**Router:**

```python
@router.get('/lithology-params', response_model=list[LithologyParamItem])
def get_lithology_params(request: Request) -> list[LithologyParamItem]: ...

@router.patch('/lithology-params/{lithology_code}', response_model=LithologyParamItem)
def patch_lithology_params(lithology_code: str,
                            payload: LithologyParamPatch,
                            request: Request) -> LithologyParamItem: ...
```

`PATCH` must raise `404` for unknown `lithology_code`. It must not use an undo command —
compaction parameters are project-wide configuration, not per-well data, and do not participate
in the undo stack.

---

### Step 2 — Backstripping engine backend

Status: done
Verification: REST endpoint returns geologically plausible burial paths
Commit: —

**Existing engines in the repository:**

Three subsidence libraries live under `repos/`. Do not duplicate their math.

| Repo | Relevant file | What to use |
|---|---|---|
| `repos/pybasin/` | `lib/pybasin_lib.py` | `integrate_porosity`, `calculate_matrix_thickness`, `compact` — pure numpy, no external deps; **primary decompaction engine** |
| `repos/Stratya2D/` | `backstripping.py` | Reference implementation for the backstripping loop; tightly coupled to its own `main` module so import only as a pattern reference, not as a library |
| `repos/pyBacktrack/` | `pybacktrack/well.py`, `lithology.py` | Reference for parameter naming (`density`, `surface_porosity`, `porosity_decay`) and physical constants (ρ_m=3330, ρ_w=1030); requires `pygplates` so do not import it |

**Unit conversions:**

pyBasin functions (`integrate_porosity`, `compact`) expect `c` in m⁻¹.
The DB column `compaction_coeff` stores c in km⁻¹.
Convert at call site: `c_m = litho.compaction_coeff / 1000.0`.

pyBacktrack uses `porosity_decay` in metres = `1 / c_m` = `1000 / c_km`.
This is equivalent — just a reciprocal form of the same Athy model.

**`app/src/subsidence/data/backstrip.py` — structure:**

```python
import sys
from pathlib import Path
# Add repos/pybasin to path so we can import its lib
sys.path.insert(0, str(Path(__file__).resolve().parents[5] / 'repos' / 'pybasin'))
from lib.pybasin_lib import integrate_porosity, calculate_matrix_thickness, compact

from dataclasses import dataclass

RHO_MANTLE = 3330.0   # kg/m³ — matches pyBacktrack well.py
RHO_WATER  = 1030.0   # kg/m³


@dataclass
class FormationInput:
    name: str
    color: str           # LithologyDictEntry.color_hex
    lithology: str       # lithology_code
    age_top_ma: float    # age at formation top (younger boundary, Ma)
    age_base_ma: float   # age at formation base (older boundary, Ma)
    current_top_m: float
    current_base_m: float

@dataclass
class LithologyParam:
    density: float           # grain density, kg/m³
    porosity_surface: float  # φ₀, fraction (0–1)
    compaction_coeff: float  # c, km⁻¹ — converted to m⁻¹ inside engine

@dataclass
class BurialPoint:
    age_ma: float
    depth_m: float

@dataclass
class SubsidenceResult:
    formation_name: str
    color: str
    lithology: str
    burial_path: list[BurialPoint]


def backstrip(
    formations: list[FormationInput],
    litho_params: dict[str, LithologyParam],
    water_depth_m: float = 0.0,
) -> list[SubsidenceResult]: ...
```

**Backstripping algorithm (inside `backstrip()`) — follows Stratya2D pattern:**

1. Filter to `valid = [f for f in formations if f.age_top_ma is not None and f.age_base_ma is not None]`.
   Silently skip formations without ages.
2. Sort `valid` by `age_base_ma` **descending** (oldest at index 0 = deepest).
3. Compute solid matrix thickness for each formation using pyBasin:
   ```python
   solid_m[f] = calculate_matrix_thickness(n0, c_m, f.current_top_m, f.current_base_m)
   ```
4. Collect time steps: all `age_top_ma` values + `0.0`, sorted oldest first.
5. For each time step `T_k`:
   - `active = [f for f in valid if f.age_top_ma >= T_k]`
   - Build paleo column from basement upward using pyBasin's `compact()`:
     ```python
     z_top = 0.0
     for f in reversed(active):   # youngest-to-oldest = top-to-bottom
         bm = solid_m[f]
         b_guess = f.current_base_m - f.current_top_m  # initial guess
         z_base = z_top + compact(bm, n0, c_m, z_top, b_guess, max_error=0.01)
         paleo_top[f][T_k] = z_top
         z_top = z_base
     ```
   - Weighted average grain density:
     `rho_s_avg = mean([litho_params[f.lithology].density for f in active])`
   - Tectonic subsidence (Airy, simplified — no sea-level correction):
     `TS = z_top * (RHO_MANTLE - rho_s_avg) / (RHO_MANTLE - RHO_WATER) + water_depth_m`
6. Return `SubsidenceResult` for each valid formation with its `burial_path`.

**`POST /api/wells/{well_id}/subsidence` response model:**

```python
class BurialPointResponse(BaseModel):
    age_ma: float
    depth_m: float

class SubsidenceResultResponse(BaseModel):
    formation_name: str
    color: str
    lithology: str
    burial_path: list[BurialPointResponse]
```

---

### Step 3 — Frontend types + computedStore

Status: done
Verification: results land in store after REST call
Commit: —

**`frontend/src/types/subsidence.ts`:**

```ts
export interface BurialPoint {
  age_ma: number
  depth_m: number
}

export interface SubsidenceResult {
  formation_name: string
  color: string
  lithology: string
  burial_path: BurialPoint[]
}

export interface LithologyParam {
  lithology_code: string
  display_name: string
  color_hex: string
  porosity_surface: number    // φ₀, fraction (0–1)
  compaction_coeff: number    // c, km⁻¹
}
```

**`frontend/src/stores/computedStore.ts`:**

```ts
import { create } from 'zustand'
import type { SubsidenceResult } from '@/types'

export interface ComputedStore {
  subsidenceCurves: SubsidenceResult[]
  isComputing: boolean
  computeError: string | null
  lastComputeTime: number
  triggerRecalculation: () => void
  setResults: (results: SubsidenceResult[]) => void
  clearResults: () => void
}

export const useComputedStore = create<ComputedStore>((set, get) => ({
  subsidenceCurves: [],
  isComputing: false,
  computeError: null,
  lastComputeTime: 0,

  triggerRecalculation() {
    // Step 3: synchronous REST; replaced by WebSocket in Step 7
  },

  setResults(results) {
    set({ subsidenceCurves: results, isComputing: false, computeError: null, lastComputeTime: Date.now() })
  },

  clearResults() {
    set({ subsidenceCurves: [], isComputing: false, computeError: null })
  },
}))
```

The `triggerRecalculation` implementation in Step 3 reads `wellDataStore.getState().well?.well_id`,
aborts any in-flight fetch (`AbortController`), sets `isComputing = true`, calls
`POST /api/wells/{id}/subsidence`, and dispatches `setResults` or `set({ computeError })` on
completion.

---

### Step 4 — SplitView resizable layout

Status: done
Verification: split persists; divider draggable
Commit: —

**`frontend/src/components/layout/SplitView.tsx`:**

```ts
interface SplitViewProps {
  left: React.ReactNode
  right: React.ReactNode
  ratio: number                    // 0–1, fraction of total width for left pane
  onRatioChange: (r: number) => void
}
```

Implementation uses a `position: relative` container. Left pane: `flex-basis = ratio * 100%`.
Divider: `width: 6px; cursor: col-resize; background: #334155`. On `pointerdown`, attach
`pointermove` to `window`, compute new ratio from `clientX`, call `onRatioChange` on
`pointerup`. Use `setPointerCapture` to avoid losing the drag.

`App.tsx` wires: `ratio={viewStore.splitRatio}` + `onRatioChange={viewStore.setSplitRatio}`.

**`viewStore.ts` additions:**

```ts
splitRatio: number                   // default 0.55
setSplitRatio: (r: number) => void   // clamps to [0.2, 0.8]
```

The backend `PATCH /api/projects/visual-config` already accepts arbitrary JSON; extend the
Pydantic `VisualConfigPatch` model to include `split_ratio: float | None = None` and persist it.

---

### Step 5 — SubsidenceCanvas + GeologicalTimescale

Status: done
Verification: burial curves + ICS timescale render from mock data
Commit: —

**`frontend/src/utils/geologicalTimescale.ts`:**

```ts
export interface GeologicPeriod {
  name: string
  abbreviation: string
  start_ma: number    // older boundary
  end_ma: number      // younger boundary (0 = present)
  color: string       // ICS standard hex
}

export const GEOLOGIC_PERIODS: GeologicPeriod[] = [
  { name: 'Quaternary',     abbreviation: 'Q',   start_ma: 2.58,  end_ma: 0,     color: '#f9f97f' },
  { name: 'Neogene',        abbreviation: 'N',   start_ma: 23.03, end_ma: 2.58,  color: '#ffff00' },
  { name: 'Paleogene',      abbreviation: 'Pg',  start_ma: 66.0,  end_ma: 23.03, color: '#fd9a52' },
  { name: 'Cretaceous',     abbreviation: 'K',   start_ma: 145.0, end_ma: 66.0,  color: '#7fc64e' },
  { name: 'Jurassic',       abbreviation: 'J',   start_ma: 201.4, end_ma: 145.0, color: '#34b2c9' },
  { name: 'Triassic',       abbreviation: 'Tr',  start_ma: 251.9, end_ma: 201.4, color: '#812b92' },
  { name: 'Permian',        abbreviation: 'P',   start_ma: 298.9, end_ma: 251.9, color: '#f04028' },
  { name: 'Carboniferous',  abbreviation: 'C',   start_ma: 358.9, end_ma: 298.9, color: '#67a599' },
  { name: 'Devonian',       abbreviation: 'D',   start_ma: 419.2, end_ma: 358.9, color: '#cb8c37' },
  { name: 'Silurian',       abbreviation: 'S',   start_ma: 443.8, end_ma: 419.2, color: '#b3e1b6' },
  { name: 'Ordovician',     abbreviation: 'O',   start_ma: 485.4, end_ma: 443.8, color: '#009270' },
  { name: 'Cambrian',       abbreviation: 'Cm',  start_ma: 538.8, end_ma: 485.4, color: '#7fa056' },
  { name: 'Precambrian',    abbreviation: 'pC',  start_ma: 4000,  end_ma: 538.8, color: '#f74370' },
]
```

**`GeologicalTimescale.tsx`:**

```ts
interface GeologicalTimescaleProps {
  timeRange: { min_ma: number; max_ma: number }  // visible time window
  width: number
  height?: number   // default 40
}
```

Renders a `<div>` with child `<div>` blocks per period whose width is proportional to the
fraction of the time range they occupy. Labels are CSS-clipped. Periods entirely outside
`timeRange` are omitted.

**`SubsidenceCanvas.tsx` axis convention:**

- X-axis: time in Ma, **oldest (max_ma) at left, 0 Ma (present) at right**
- Y-axis: depth in metres, **0 at top, increasing downward** (same orientation as log view)
- Both axes derived from `computedStore.subsidenceCurves` bounds or props if provided

**`subsidenceRenderer.ts`:**

```ts
export function drawBurialCurves(
  ctx: CanvasRenderingContext2D,
  curves: SubsidenceResult[],
  timeToX: (age_ma: number) => number,
  depthToY: (depth_m: number) => number,
): void {
  for (const curve of curves) {
    ctx.beginPath()
    ctx.strokeStyle = curve.color
    ctx.lineWidth = 1.5
    const path = [...curve.burial_path].sort((a, b) => b.age_ma - a.age_ma)
    for (let i = 0; i < path.length; i++) {
      const x = timeToX(path[i].age_ma)
      const y = depthToY(path[i].depth_m)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

export function drawFormationFills(
  ctx: CanvasRenderingContext2D,
  curves: SubsidenceResult[],
  timeToX: (age_ma: number) => number,
  depthToY: (depth_m: number) => number,
): void {
  // Fill between adjacent curves (index i and i+1) using curves[i].color at 30% opacity.
  // Walk the burial paths together (same age steps), filling the polygon between them.
  for (let i = 0; i < curves.length - 1; i++) {
    const upper = [...curves[i].burial_path].sort((a, b) => b.age_ma - a.age_ma)
    const lower = [...curves[i + 1].burial_path].sort((a, b) => a.age_ma - b.age_ma)
    if (upper.length < 2 || lower.length < 2) continue
    ctx.beginPath()
    for (const pt of upper) ctx.lineTo(timeToX(pt.age_ma), depthToY(pt.depth_m))
    for (const pt of lower) ctx.lineTo(timeToX(pt.age_ma), depthToY(pt.depth_m))
    ctx.closePath()
    ctx.fillStyle = curves[i].color + '4d'   // 30% opacity suffix
    ctx.fill()
  }
}
```

---

### Step 6 — Formation drag → debounced REST recalculation

Status: done
Verification: drag → curves update within 1.5 s
Commit: —

Dynamic import pattern (same as `pollStatus` in `wellDataStore.ts`):

```ts
// In wellDataStore.ts — inside updateFormationDepth debounced PATCH success handler:
const { useComputedStore } = await import('./computedStore')
useComputedStore.getState().triggerRecalculation()
```

Add the same `await import('./computedStore')` + `triggerRecalculation()` call at the end of
`addFormation` and `removeFormation` success handlers.

**`StatusBar.tsx` computing indicator:**

```tsx
const isComputing = useComputedStore((s) => s.isComputing)
// left slot already shows cursorDepth
// center slot:
{isComputing && <span className="status-bar__computing">Computing…</span>}
```

---

### Step 7 — WebSocket recalculation pipeline

Status: done
Verification: WS replaces REST; reconnects after backend restart
Commit: —

**FastAPI WebSocket endpoint (`subsidence.py`):**

```python
from fastapi import WebSocket, WebSocketDisconnect
import json

@router.websocket('/ws/recalculate')
async def ws_recalculate(websocket: WebSocket, request: Request):
    manager = _require_open_project(request)  # or read from app state
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            well_id = data.get('well_id')
            await websocket.send_json({'status': 'computing', 'progress': 0.0})
            results = _compute_subsidence(manager, well_id)
            await websocket.send_json({
                'status': 'complete',
                'results': [r.model_dump() for r in results],
            })
    except WebSocketDisconnect:
        pass
```

`_compute_subsidence(manager, well_id)` is a synchronous helper that reads formations and
lithology params from the open project DB and calls `backstrip()`. Because it is CPU-bound and
fast (<100 ms for typical well data), it runs directly in the async handler without a thread pool
for Phase 4. Use `asyncio.to_thread` in Phase 5 if profiling shows blocking.

**`frontend/src/hooks/useWebSocket.ts`:**

```ts
interface UseWebSocketOptions {
  url: string
  onMessage: (data: unknown) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket(options: UseWebSocketOptions): {
  send: (data: unknown) => void
  readyState: number
}
```

Implementation: create `WebSocket` on mount; on `close`, schedule reconnect with exponential
backoff starting at 1 s, capped at 30 s; on `message`, call `onMessage(JSON.parse(event.data))`;
expose `send(data)` which calls `ws.send(JSON.stringify(data))` when `readyState === OPEN`, else
queues the message and drains on connect. Cleanup on unmount.

**`frontend/src/api/subsidenceSocket.ts`:**

```ts
let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function sendRecalculation(wellId: string): void {
  ensureConnected()
  socket?.send(JSON.stringify({ well_id: wellId }))
}

function onMessage(raw: MessageEvent): void {
  const data = JSON.parse(raw.data as string)
  if (data.status === 'computing') {
    useComputedStore.getState().set({ isComputing: true, computeError: null })
  } else if (data.status === 'complete') {
    useComputedStore.getState().setResults(data.results)
  } else if (data.status === 'error') {
    useComputedStore.getState().set({ isComputing: false, computeError: data.message })
  }
}
```

`computedStore.triggerRecalculation()` becomes:

```ts
triggerRecalculation() {
  const wellId = useWellDataStore.getState().well?.well_id
  if (!wellId) return
  set({ isComputing: true, computeError: null })
  sendRecalculation(wellId)
}
```

---

### Step 8 — Compaction parameters editor UI

Status: done
Verification: φ₀ change → curves update; value persists
Commit: —

**`SettingsInspector.tsx` — `compaction-params` branch:**

```tsx
if (selectedObject.type === 'compaction-params') {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Compaction parameters</div>
        <div className="template-panel__value">Athy model</div>
      </div>
      <table className="compaction-table">
        <thead>
          <tr><th>Lithology</th><th>φ₀</th><th>c (km⁻¹)</th></tr>
        </thead>
        <tbody>
          {lithologyParams.map((p) => (
            <tr key={p.lithology_code}>
              <td>{p.display_name}</td>
              <td>
                <input
                  type="number" step="0.01" min="0" max="1"
                  defaultValue={p.porosity_surface}
                  onBlur={(e) => void updateLithologyParam(p.lithology_code,
                    { porosity_surface: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number" step="0.01" min="0" max="5"
                  defaultValue={p.compaction_coeff}
                  onBlur={(e) => void updateLithologyParam(p.lithology_code,
                    { compaction_coeff: Number(e.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**`DataManagerPane` — Models section:**

Add a static `"Compaction params"` row under the `Models` tab. Clicking it calls
`setSelectedObject({ type: 'compaction-params' })`. No tree expansion needed — it is a leaf node.

---

### Step 9 — LTTB server-side LOD

Status: done
Verification: Canvas frame time < 2 ms; LOD fires on zoom out
Commit: —

**`app/src/subsidence/data/lttb.py`:**

```python
import numpy as np

def lttb(depths: np.ndarray, values: np.ndarray, threshold: int) -> np.ndarray:
    """
    Largest-Triangle-Three-Buckets downsampling.
    Returns integer indices of retained samples.
    Always retains first and last sample.
    """
    n = len(depths)
    if n <= threshold:
        return np.arange(n)

    every = (n - 2) / (threshold - 2)
    indices = [0]
    a = 0
    for i in range(threshold - 2):
        avg_start = int((i + 1) * every) + 1
        avg_end   = int((i + 2) * every) + 1
        avg_x = depths[avg_start:avg_end].mean()
        avg_y = values[avg_start:avg_end].mean()

        range_start = int(i * every) + 1
        range_end   = int((i + 1) * every) + 1
        max_area = -1.0
        next_a = range_start
        ax, ay = depths[a], values[a]
        for j in range(range_start, range_end):
            area = abs((ax - avg_x) * (values[j] - ay) - (ax - depths[j]) * (avg_y - ay))
            if area > max_area:
                max_area = area
                next_a = j
        indices.append(next_a)
        a = next_a

    indices.append(n - 1)
    return np.array(indices, dtype=np.intp)
```

**LOD endpoint:**

```python
@router.get('/wells/{well_id}/curves', response_model=list[CurveResponse])
def get_curves_lod(
    well_id: str,
    depth_min: float,
    depth_max: float,
    resolution: int,
    request: Request,
) -> list[CurveResponse]:
    # loads full curve data, clips to [depth_min, depth_max] + 5% buffer,
    # runs lttb(..., threshold=resolution) per curve, returns result
```

**Frontend LOD hook (`App.tsx` or `LogViewPanel`):**

Fire when `depthPerPixel > 1.0` (> 1 m per screen pixel): call `fetchCurvesLOD` with the
current `visibleDepthRange` and `resolution = Math.ceil(viewportHeight / 2)`. Debounce 200 ms.
When `depthPerPixel ≤ 1.0`, reload full resolution data via `wellDataStore.loadWell`.

---

### Step 10 — MD ↔ TVD depth toggle

Status: done
Verification: TVD labels correct; formation lines shift; undoing toggle restores MD
Commit: —

**`frontend/src/utils/depthTransform.ts`:**

```ts
export interface SurveyPoint {
  md: number
  inclination_deg: number
  azimuth_deg: number
}

export interface TVDTable {
  md: Float32Array
  tvd: Float32Array
}

export function minCurvatureToTVD(survey: SurveyPoint[]): TVDTable {
  // minimum curvature method:
  // RF = 2/DLS * tan(DLS/2) where DLS = dogleg severity per step
  // ΔTVD = ΔMD/2 * (cos(I1) + cos(I2)) * RF
  // Accumulate from surface (TVD=0 at first survey point)
}

export function mdToTvd(md: number, table: TVDTable): number {
  // binary search + linear interpolation between table entries
}
```

The minimum curvature formula per survey interval (MD₁ → MD₂):

```
ΔMD = MD₂ - MD₁
α  = dogleg in radians = arccos(cos(I₂ - I₁) - sin(I₁)·sin(I₂)·(1 - cos(A₂ - A₁)))
RF = α === 0 ? 1.0 : (2/α) · tan(α/2)
ΔTVD = ΔMD/2 · (cos(I₁) + cos(I₂)) · RF
```

where I = inclination in radians, A = azimuth in radians.

**`wellDataStore.ts` TVD integration:**

Add `tvdTable: TVDTable | null` to the store. After `loadWell()`, if `well.deviation` is
present, fetch the raw survey from `GET /api/wells/{id}/deviation` (add this endpoint if not
present — should return `{ md: number[], inclination: number[], azimuth: number[] }`) and
compute `tvdTable = minCurvatureToTVD(survey)`.

**`viewStore.ts` additions:**

```ts
depthType: 'MD' | 'TVD'
setDepthType: (t: 'MD' | 'TVD') => void
```

All components that translate a depth value to a pixel position check `viewStore.depthType`:
- `MD`: use `depth_md` directly
- `TVD`: use `mdToTvd(depth_md, wellDataStore.tvdTable)` if table exists, else fall back to MD

---

## Existing repos used (read-only)

```
repos/
├── pybasin/lib/pybasin_lib.py     USED — integrate_porosity, calculate_matrix_thickness, compact
│                                         (imported at runtime via sys.path; pure numpy, no deps)
├── Stratya2D/backstripping.py     REFERENCE ONLY — backstripping loop pattern
└── pyBacktrack/pybacktrack/
    ├── well.py                    REFERENCE ONLY — physical constants (ρ_m, ρ_w)
    └── lithology.py               REFERENCE ONLY — Lithology parameter model naming
```

Do not modify any file under `repos/`. They are upstream libraries.

---

## New and modified files

```
app/src/subsidence/
├── api/
│   ├── compaction.py           NEW — GET/PATCH /api/lithology-params
│   ├── subsidence.py           NEW — POST /api/wells/{id}/subsidence + /ws/recalculate
│   └── main.py                 MODIFIED — register compaction + subsidence routers
└── data/
    ├── backstrip.py            NEW — backstripping adapter wrapping repos/pybasin integrate_porosity + compact
    ├── lttb.py                 NEW — Largest-Triangle-Three-Buckets downsampling
    └── schema.py               MODIFIED — LithologyDictEntry gains density + porosity_surface + compaction_coeff

sample_data/
└── lithology_defaults.csv      MODIFIED — add density, phi0, c columns to seed data

frontend/src/
├── types/
│   └── subsidence.ts           NEW — SubsidenceResult, BurialPoint, LithologyParam, SubsidenceInput
├── stores/
│   ├── computedStore.ts        NEW — subsidenceCurves, isComputing, triggerRecalculation
│   ├── wellDataStore.ts        MODIFIED — tvdTable, loadLithologyParams, updateLithologyParam
│   ├── viewStore.ts            MODIFIED — splitRatio, setSplitRatio, depthType, setDepthType
│   └── index.ts                MODIFIED — export useComputedStore
├── api/
│   └── subsidenceSocket.ts     NEW — WebSocket client for /ws/recalculate
├── hooks/
│   └── useWebSocket.ts         NEW — generic reconnecting WebSocket hook
├── utils/
│   ├── geologicalTimescale.ts  NEW — GEOLOGIC_PERIODS constant array
│   └── depthTransform.ts       NEW — minCurvatureToTVD, mdToTvd
├── renderers/
│   └── subsidenceRenderer.ts   NEW — drawBurialCurves, drawFormationFills
├── components/
│   ├── layout/
│   │   ├── SplitView.tsx       NEW — resizable horizontal two-pane split
│   │   └── index.ts            MODIFIED — export SplitView
│   ├── subsidence/             NEW directory
│   │   ├── SubsidencePanel.tsx     NEW — container with loading overlay + empty state
│   │   ├── SubsidenceCanvas.tsx    NEW — Canvas: time × depth burial history plot
│   │   ├── GeologicalTimescale.tsx NEW — ICS colored period bar
│   │   ├── SubsidenceControls.tsx  NEW — overlay toggles stub
│   │   └── index.ts                NEW — barrel export
│   ├── layout/
│   │   ├── StatusBar.tsx       MODIFIED — computing indicator slot
│   │   └── SettingsInspector.tsx MODIFIED — compaction-params branch
│   └── logview/
│       ├── DepthTrack.tsx      MODIFIED — MD/TVD label switching
│       └── LogViewPanel.tsx    MODIFIED — LOD effect, TVD propagation
├── App.tsx                     MODIFIED — SplitView wrapper, TVD toggle button
└── index.css                   MODIFIED — subsidence panel + compaction table styles
```

---

## Execution order

```
Step 1  (compaction params schema + API)
Step 2  (backstripping engine + REST endpoint)  ← depends on Step 1
        ↓
Step 3  (computedStore + TypeScript types)
Step 4  (SplitView layout)                      ← parallel with Step 3
        ↓
Step 5  (SubsidenceCanvas + GeologicalTimescale)
        ↓
Step 6  (formation drag → REST recalculation)
        ↓
Step 7  (WebSocket pipeline — replaces REST)
        ↓
Step 8  (compaction params editor UI)           ← depends on Steps 1 + 7
Step 9  (LTTB LOD)                              ← parallel with Step 8
Step 10 (MD ↔ TVD toggle)                       ← parallel with Steps 8 + 9
```

---

## Out of Scope for Phase 4

| Feature | Phase | Notes |
|---|---|---|
| Water depth history overlay | 5 | `SubsidenceControls` stub added; actual curve + UI deferred |
| Sea-level curve correction | 5 | `backstrip()` has `water_depth_m` param; sea-level lookup table deferred |
| Maturity / temperature overlays | 5 | Require vitrinite reflectance model (Sweeney-Burnham); Phase 5 |
| Multi-well subsidence comparison | 5 | Single-well only in Phase 4; comparison requires shared time axis across wells |
| Layout template save/load | 5 | SplitView ratio saved; full template (track order, scale) deferred |
| PNG/SVG full export | 5 | Export endpoints exist; full off-screen Canvas rendering deferred |
| Right-click context menus | 5 | Deferred from Phase 3; build after Phase 4 panels are stable |
| Discrete curve import + renderer | 5 | `curve_type='discrete'` field in schema; importer + renderer deferred |
| Dark/light theme | 5 | CSS variable skeleton exists; theme toggle deferred |
| Alembic schema migrations | 5 | `LithologyDictEntry` column additions in Step 1 use SQLAlchemy `ALTER` guard for now |
| Curve fill renderer (crossover, baseline fills) | 5 | `fillRenderer.ts` stub exists; crossover detection deferred |
| WebWorker computation offload | 5 | `asyncio.to_thread` and/or WebWorker for heavy LTTB deferred |
| Subsidence controls (SubsidenceControls.tsx full implementation) | 4+ | Stub only in Step 5; toggles wired in Phase 5 |

---

## Definition of Done for Phase 4

- `POST /api/wells/{id}/subsidence` returns geologically plausible burial paths for a well with
  3+ aged and lithologied formation tops; decompacted paleo-thicknesses are greater than present
  thicknesses
- `SplitView` divider is draggable; split ratio persists across project close + reopen
- `SubsidenceCanvas` renders burial curves with correct axis orientation (time left = old,
  depth down = deeper); `GeologicalTimescale` bar shows ICS period colors
- Dragging a formation top in the log view triggers recalculation; `SubsidenceCanvas` updates
  within 1.5 s (300 ms debounce + computation); `StatusBar` shows "Computing…" during the wait
- WebSocket replaces the REST polling path; backend restart → client reconnects automatically;
  next drag triggers a fresh recalculation
- Changing shale φ₀ in the compaction editor → burial curves update; page refresh → value
  retained
- LTTB LOD fetches fewer curve points at coarse zoom; Canvas frame time < 2 ms at all zoom levels
- TVD toggle available when deviation data are present; toggling switches all depth labels,
  formation line positions, and StatusBar readout; toggling back restores MD without drift
- `npx tsc --noEmit` — zero errors
- Backend unit tests for `backstrip()` and `lttb()` pass

