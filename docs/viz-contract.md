# SUBSIDENCE — Visualization Contract

> This document is the authoritative specification for the Dash visualization layer.
> Nothing is built until it is described here. Changes to architecture or behaviour
> are made here first, then in code.

---

## 1. Overall Layout

```
┌──────────────┬────────────────────────────────────────────────────────────────┐
│              │  [Burial Panel Card]              [Well Log Panel]             │
│   Data       │  ┌──────────────────────────────┐  ┌──────────────────────┐   │
│   Manager    │  │ Timescale bar (spans full    │  │ Track headers:       │   │
│   (sidebar)  │  │ width of card)               │  │ [Strat][Litho][Curve…]│  │
│              │  ├──────────────┬───────────────┤  │ ┌────┬─────┬───────┐ │   │
│              │  │ Multi-Well   │ Selected Well │  │ │Str.│Lith.│ Crv.  │ │   │
│              │  │ Comparison   │ burial +      │  │ │    │     │       │ │   │
│              │  │ (lines only) │ strat polygons│  │ │    │     │       │ │   │
│              │  │              │               │  │ └────┴─────┴───────┘ │   │
│              │  └──────────────┴───────────────┘  └──────────────────────┘   │
│              │  [Fit to subsidence chart] button                              │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

- **Tabs**: 1D Modelling | 2D Modelling (2D is a placeholder, unchanged)
- **Action toolbar** (Create well / Modify / Add deviation / Add strat / Add log / Clear / Delete) — above all panels, unchanged from today

---

## 2. Data Manager Sidebar

### Component: `DataManagerSidebar`
- **Well selector dropdown** — `id="well-selector"`, reads/writes `selected-well` Store
- **Object list** — shows what is loaded for the selected well (burial curves, strat intervals, lithology intervals, log tracks, deviation survey status)
- **No test/debug controls** — the current "Left Summary Test Settings" block is removed

---

## 3. Burial Panel

### 3.1 Shared Timescale Bar
- A single `dcc.Graph(id="burial-timescale")` spanning the full width of the burial card
- Height: 80 px, fixed
- Shows two rows of horizontal bars: System row (Cenozoic, Mesozoic…) and Period row (Q, Ng, Pg, K, J, Tr…)
- X axis: age in Ma, reversed (0 on right, 252 on left)
- No zoom or pan — `staticPlot=True`
- Aligned to the same Ma range as both burial charts below it

### 3.2 Multi-Well Comparison Chart
- `dcc.Graph(id="burial-multi")`
- One curve per well — the **primary burial curve** (first in the well's `burial_curves` list, labelled with the well name)
- Colour palette rotates across wells: `["#264653", "#2a9d8f", "#e76f51", "#457b9d", "#e9c46a"]`
- **Click on a curve** → selects that well (writes well name to `selected-well` Store)
  - Each trace carries `customdata=[well_name] * len(ages_ma)` so `clickData["points"][0]["customdata"]` returns the name directly
- X axis: age Ma, reversed, range `[SUMMARY_AGE_MAX_MA, SUMMARY_AGE_MIN_MA]`
- Y axis: depth m, reversed, range `[y_max, y_min]` from `depth-viewport` Store
- Both axes zoomable and pannable
- On zoom/pan: writes new range to `depth-viewport` Store (server callback)

### 3.3 Selected Well Chart
- `dcc.Graph(id="burial-selected")`
- Shows all burial curves for the selected well (present-day, compacted, decompacted)
- **Plus**: filled formation polygons behind the curves
  - One `go.Scatter(fill="toself")` per `StratInterval`
  - Polygon vertices (in data coordinates): `(start_age_ma, top_m) → (end_age_ma, top_m) → (end_age_ma, base_m) → (start_age_ma, base_m) → close`
  - Fill colour: `StratInterval.color_hex` at **35% opacity** (`rgba`)
  - Line: same hex, width 0.8
  - Polygon traces are added **before** burial curve traces so curves render on top
- X/Y axes: **identical range** to Multi-Well chart at all times
  - Both charts share `depth-viewport` Store for Y range
  - X range is fixed to `[SUMMARY_AGE_MAX_MA, SUMMARY_AGE_MIN_MA]` (no user zoom on X)
- On zoom/pan of this chart: also writes to `depth-viewport` Store

### 3.4 "Fit to Subsidence Chart" Button
- `dbc.Button(id="fit-to-subsidence")`
- Located below the burial card
- On click: reads the current Y range of `burial-selected` and writes it to `depth-viewport` Store, which cascades to all well log tracks via clientside callback

---

## 4. Well Log Panel

### 4.1 Track Architecture
Each track is an **independent `dcc.Graph`** (not a Plotly subplot).
All tracks share a Y axis (depth) via the `depth-viewport` Store and a clientside JS callback.

Track types:
| Type | ID pattern | Width | Contents |
|---|---|---|---|
| Stratigraphy | `"track-strat"` | narrow (fixed ~80 px) | Coloured depth intervals + unit labels |
| Lithology | `"track-litho"` | narrow (fixed ~80 px) | Coloured depth intervals + lith labels |
| Curve track | `"track-curve-{mnemonic}"` | flexible | 1–2 curves, optional log scale |
| Depth scale | `"track-depth"` | narrow (fixed ~50 px) | Depth labels only |

### 4.2 Track Header
Above each track (outside the `dcc.Graph`) is a header `html.Div` containing:
- Track **name/mnemonic** label
- **Unit** label
- For curve tracks only: **min** and **max** numeric inputs (`dbc.Input`) with component IDs using pattern matching:
  ```
  {"type": "track-xmin", "mnemonic": mnemonic}
  {"type": "track-xmax", "mnemonic": mnemonic}
  ```
- For curve tracks with log scale: a **Log scale toggle** (`dbc.Switch`)
- **Pick mode indicator**: when pick mode is active, track header gets a visual highlight

### 4.3 Y Axis Synchronisation
- All track graphs use `uirevision=well_name` — Plotly preserves zoom state across figure updates
- `dcc.Store(id="depth-viewport", data={"y_min": 0, "y_max": 2500})`
- A **clientside callback** in `assets/sync.js` watches `depth-viewport` and calls `Plotly.relayout` on every track graph ID in `track-graph-ids` Store
- This avoids a round-trip to Python for what is a pure DOM operation

```js
// assets/sync.js
window.dash_clientside = window.dash_clientside || {};
window.dash_clientside.sync = {
    syncDepthViewport: function(viewport, graphIds) {
        if (!viewport || !graphIds) return window.dash_clientside.no_update;
        graphIds.forEach(function(gid) {
            var el = document.getElementById(gid);
            if (el && el._fullLayout) {
                Plotly.relayout(el, {
                    'yaxis.range[0]': viewport.y_min,
                    'yaxis.range[1]': viewport.y_max
                });
            }
        });
        return window.dash_clientside.no_update;
    }
};
```

### 4.4 Track Generation
Tracks are generated **dynamically by a callback** when the selected well changes.
The callback outputs `children` of a container `html.Div(id="well-log-panel")` and also writes `track-graph-ids` Store.

Track generation logic:
1. Always: stratigraphy track, lithology track
2. One curve track per entry in `payload["curves"]`
3. Always: depth scale track (last)

### 4.5 Per-Track X Scale
A pattern-matching callback fires when any min/max input changes:
- Reads min/max values for the triggered mnemonic
- Updates the corresponding track graph's `xaxis.range`
- If log scale is on: sets `xaxis.type = "log"`
- Writes updated ranges to `track-x-ranges` Store keyed by mnemonic

### 4.6 Stratigraphy Track
- `go.Bar` traces (horizontal, `orientation="v"` effectively — vertical bars by depth)
- Each `StratInterval` → one bar: `base=[top_m]`, `y=[thickness]`, `marker.color=color_hex`
- Annotation at midpoint with `unit_name`
- **Derived from picks** (see Section 5.4): when picks exist for this well, they replace the demo strat intervals

### 4.7 Lithology Track
- Same structure as stratigraphy track but uses `LithologyInterval` data
- Discrete (coloured blocks), labels at midpoint

### 4.8 Curve Track
- `go.Scatter(mode="lines")` for each curve in the track
- Y axis: depth (shared, from `depth-viewport`)
- X axis: controlled by track header min/max inputs and log scale toggle
- Two curves on one track: both on the same X axis (second curve gets a secondary `go.Scatter`)
  - Primary curve: left X axis
  - Secondary curve: right X axis (`yaxis2` in Plotly terms — actually `xaxis` and `xaxis2` since this is transposed)
  - **Note**: for the transposed well log (depth on Y), each curve has its own X range. Two curves on one track means two X axes, one on top, one on bottom of the track header

---

## 5. Pick Mode

### 5.1 Pick Mode Toggle
- `dbc.Button(id="pick-mode-toggle", children="Pick mode: OFF")`
- Located in the well log panel header (above all tracks)
- Writes to `dcc.Store(id="pick-mode", data=False)`
- When active: button turns primary colour, label changes to "Pick mode: ON"
- Container gets CSS class `picking-active` → cursor changes to crosshair on all track graphs

### 5.2 Pick Name Input
- `dbc.Input(id="pick-name-input", placeholder="Pick name…")`
- Text field next to the toggle button
- Required: pick is not created if the field is empty

### 5.3 Creating / Moving a Pick
- When `pick-mode` is `True` and user clicks on any curve track or the stratigraphy track:
  - `clickData["points"][0]["y"]` → depth of click
  - Pick is stored as `picks[well_name][pick_name] = {"depth_m": float, "age_ma": None}`
  - If a pick with the same name already exists for this well: its depth is **updated** (moved)
  - The pick name comes from `pick-name-input`
  - **Age assignment**: after pick is placed, a dropdown in the pick panel lets the user assign an age from the stratigraphic dictionary (see 5.6)

### 5.4 Pick → Stratigraphy Recalculation
Picks define formation boundaries. The stratigraphy track is **derived state** from picks.

Rules:
- Picks are sorted by depth ascending
- Between two consecutive picks `(p_i, p_{i+1})`: one `StratInterval` spanning `[p_i.depth_m, p_{i+1}.depth_m]`
- Above the shallowest pick: interval spans from `well_top_m` (0 or well KB) to `p_0.depth_m`
- Below the deepest pick: interval spans from `p_last.depth_m` to `well_td_m` (TD of well)
- Formation colour and age come from the stratigraphic dictionary matched by `pick.age_ma`
- If a pick has no age assigned yet: the interval gets a neutral colour (`#cccccc`) and label "Unknown"

Trigger: any change to `picks-store` → `update_strat_track` callback fires → rebuilds the strat track figure

### 5.5 Deleting a Pick
- A `dbc.Select(id="pick-delete-selector")` in the pick panel lists all picks for the current well
- A `dbc.Button(id="delete-pick-btn", color="danger")` removes the selected pick from `picks-store`
- On delete: stratigraphy recalculates (the two intervals that the pick separated are merged into one, taking the shallower pick's age/colour)

### 5.6 Age Assignment from Stratigraphic Dictionary
- After placing a pick, a `dbc.Select(id="pick-age-selector")` is populated with entries from the stratigraphic dictionary
- Options: `{label: "unit_name (age_ma Ma)", value: age_ma}`
- Selecting an option writes `age_ma` to the pick's entry in `picks-store`
- This triggers stratigraphy recalculation (correct colour and label now available)

### 5.7 Pick Visualisation on Tracks
Picks are rendered as:
- A horizontal dashed line (`go.Scatter`, `mode="lines"`, `line.dash="dash"`, `line.color="#334155"`, `line.width=1`)
- An annotation to the right of the line showing `pick_name` + depth
- Added via `fig.add_shape` (horizontal line) and `fig.add_annotation`
- Rendered on **all tracks** (strat, litho, all curve tracks)

---

## 6. Shared State (dcc.Store Registry)

| Store ID | Type | Initial value | Written by | Read by |
|---|---|---|---|---|
| `selected-well` | `str` | first well name | well-selector dropdown, burial-multi clickData | all figure callbacks |
| `depth-viewport` | `dict {y_min, y_max}` | `{0, 2500}` | burial chart relayoutData callbacks, Fit button | clientside sync, well log track callbacks |
| `picks-store` | `dict {well_name: {pick_name: {depth_m, age_ma}}}` | `{}` | pick click callback, delete callback, age-assign callback | strat track callback, pick selector, pick visualisation |
| `pick-mode` | `bool` | `False` | pick-mode-toggle button | pick click callback, CSS class on container |
| `track-x-ranges` | `dict {mnemonic: {x_min, x_max, log_scale}}` | `{}` | track header min/max inputs | curve track figure callbacks |
| `track-graph-ids` | `list[str]` | `[]` | well log track generation callback | clientside sync callback |
| `sync-dummy` | `any` | `None` | clientside sync (absorbs no_update return) | never |

---

## 7. File Structure

```
app/src/subsidence/viz/
    __init__.py                  # exposes `app`
    app.py                       # creates Dash instance, assembles layout, registers callbacks
    constants.py                 # DATASET, SYSTEM_BANDS, AGE_BANDS, CARD_CLASS, etc.
    layout/
        __init__.py              # build_layout() → dbc.Container
        sidebar.py               # build_data_manager_col()
        burial_panel.py          # build_burial_card(), build_burial_cols()
        well_log_panel.py        # build_well_log_panel() — container only, children via callback
        modals.py                # all _build_*_modal() builders (unchanged)
    callbacks/
        __init__.py              # register_all_callbacks(app)
        burial.py                # burial figure callbacks + timescale + well click→select
        well_log.py              # track generation callback + X-range callback
        picks.py                 # pick mode toggle, click→pick, delete, age assign, strat recalc
        sync.py                  # depth-viewport writer (from relayoutData), Fit button
        ui_state.py              # tab switch, modal toggles, object manager list
    plotting/
        __init__.py              # re-exports all public symbols
        burial.py                # BurialCurve, TimeScaleBand, build_burial_figure(), build_timescale_figure()
        well_log.py              # StratInterval, CurveTrack, LithologyInterval, build_well_figure()
                                 # (build_well_figure kept for now; replaced in Phase 3)
        picks.py                 # add_picks_to_figure(fig, picks) — adds shapes + annotations
    assets/
        sync.js                  # clientside callback: depth-viewport → Plotly.relayout on all tracks
```

---

## 8. Implementation Phases

### Phase 1 — Code Split (no behaviour change)
**Goal**: Identical behaviour, code in the target file structure.
**Output**: All files in Section 7 created. Old `plotting.py` removed.
**Test**: `python -m subsidence.viz.app` starts with identical UI.

### Phase 2 — Store Infrastructure + Depth Sync + Fit Button
**Goal**: All `dcc.Store` components in layout. Depth-viewport sync working.
**Steps**:
1. Add all Stores from Section 6 to `build_layout()`
2. Write `assets/sync.js` clientside callback
3. Write `callbacks/sync.py`: `relayoutData` watcher for both burial charts → `depth-viewport`
4. Wire "Fit to subsidence chart" button callback
5. Remove debug sliders from sidebar
**Test**: Pan burial chart → all well log tracks follow. Click Fit → syncs.

### Phase 3 — Per-Track Well Log
**Goal**: Separate `dcc.Graph` per track replacing `build_well_figure()`.
**Steps**:
1. Add `plotting/picks.py` stub
2. Write `build_strat_track_figure()`, `build_litho_track_figure()`, `build_curve_track_figure()`, `build_depth_scale_figure()` in `plotting/well_log.py`
3. Write track generation callback in `callbacks/well_log.py`
4. Write X-range pattern-matching callback
5. Build track header components with min/max inputs and log scale toggle
**Test**: Switch wells → tracks regenerate. Edit track min/max → X axis rescales. Log scale toggle works.

### Phase 4 — Burial Panel Redesign
**Goal**: Formation polygons on Selected Well chart. Click-to-select on Multi-Well. Single shared timescale.
**Steps**:
1. Update `build_burial_figure()` to accept optional `strat_intervals`
2. Add `_strat_polygon_trace()` helper in `plotting/burial.py`
3. Update `burial_panel.py` layout: single timescale spanning full card width
4. Add `customdata` to Multi-Well traces
5. Add well-click → `selected-well` Store callback
**Test**: Selected Well shows strat polygons. Click curve in Multi-Well → well changes.

### Phase 5 — Pick Mode
**Goal**: Full pick workflow (create, move, delete, age assignment, strat recalc).
**Steps**:
1. Add pick mode toggle button and pick name input to `well_log_panel.py`
2. Write `callbacks/picks.py`: click handler, delete handler, age assign handler
3. Write `_derive_strat_from_picks()` in `plotting/well_log.py`
4. Update track generation callback to inject picks as shapes and rebuild strat from picks
5. Write `plotting/picks.py`: `add_picks_to_figure()`
**Test**: Toggle pick mode → cursor changes. Click on track → pick line appears on all tracks. Delete pick → strat recalculates. Assign age → strat gets correct colour.

---

## 9. Key Contracts (Interface Boundaries)

### `build_burial_figure()` signature (Phase 4+)
```python
def build_burial_figure(
    *,
    curves: list[BurialCurve],
    strat_intervals: list[StratInterval] | None = None,  # added in Phase 4
    height: int = 260,
    left_axis_position: float = 0.0,
    rectangle_length: float = 1.0,
    show_axes: bool = True,
    age_min_ma: float = 0.0,
    age_max_ma: float = 252.0,
) -> go.Figure: ...
```

### `_derive_strat_from_picks()` signature (Phase 5)
```python
def _derive_strat_from_picks(
    picks: dict[str, dict],      # {pick_name: {depth_m: float, age_ma: float | None}}
    well_top_m: float,
    well_td_m: float,
    strat_dict: list[dict],      # stratigraphic dictionary entries: {unit_name, age_ma, color_hex}
) -> list[StratInterval]: ...
```
Rules:
- Sorts picks by `depth_m` ascending
- Intervals: `well_top → p0`, `p0 → p1`, …, `p_last → well_td`
- Colour/name from `strat_dict` matched by closest `age_ma`; neutral `#cccccc` / "Unknown" if `age_ma` is None

### `add_picks_to_figure()` signature (Phase 5)
```python
def add_picks_to_figure(
    fig: go.Figure,
    picks: dict[str, dict],      # {pick_name: {depth_m, age_ma}}
    x_range: tuple[float, float],  # x-axis range of the specific track (for line extent)
) -> go.Figure: ...
```
Adds one horizontal `go.Scatter` (dashed line) + one annotation per pick, in-place, returns fig.

### `depth-viewport` Store schema
```json
{ "y_min": 0.0, "y_max": 2500.0 }
```
Both values are **depth in metres, positive downward**. `y_min` is the shallower end of the viewport.

### Pick entry schema (inside `picks-store`)
```json
{
  "WELL-A": {
    "Top Cretaceous": { "depth_m": 1500.0, "age_ma": 66.0 },
    "Top Paleogene":  { "depth_m": 1200.0, "age_ma": 23.03 }
  }
}
```

---

## 10. Out of Scope (deferred to Phase 6+)
- Connecting real SQLite data (currently demo dict only)
- Deviation survey visualisation
- 2D modelling tab (placeholder only)
- Export functions
- Undo/redo for picks
