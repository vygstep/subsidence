# SUBSIDENCE - Visualization Contract

> This document is the authoritative contract for the Dash visualization layer.
> UI behaviour is agreed here first, then implemented in code.

---

## 1. Scope

This contract covers the current 1D modelling UI only:

- the two burial summary views
- the independent well tracks
- shared vertical scale behaviour
- the `Sync charts` control

It does not define calculation logic or real geological results yet. Current plots are still a test plotting layout.

---

## 2. Current Views

The current 1D screen contains six syncable graphs:

1. `burial-multi`
   Multi-well comparison chart.
2. `burial-selected`
   Selected-well burial chart.
3. `track-strat`
   Combined stratigraphy track with two discrete lanes: `System` and `Age`.
4. `track-lithology`
   Discrete lithology interval track.
5. `track-log`
   Continuous log track.
6. `track-depth`
   Depth scale track.

All graphs use depth on the Y axis, positive downward.

---

## 3. Shared State

### 3.1 `selected-well`

```json
"WELL-A"
```

Meaning:

- currently selected well name

Written by:

- well selector dropdown
- multi-well chart click selection

Read by:

- all figure-building callbacks

### 3.2 `depth-viewport`

```json
{ "r0": 2500.0, "r1": 0.0 }
```

Meaning:

- `r0` = lower visible Y boundary, deeper value
- `r1` = upper visible Y boundary, shallower value
- values are Plotly `yaxis.range` values in metres

Rules:

- this is the single source of truth for the last active Y viewport
- it is written from real user interaction on a syncable graph even when sync is OFF
- it is never inferred from stale `relayoutData` of another graph

### 3.3 `sync-enabled`

```json
false
```

Meaning:

- `false` = all syncable graphs are independent
- `true` = all syncable graphs share the same Y viewport

Written by:

- `Sync charts` toggle button

Read by:

- server sync callbacks
- clientside viewport-apply callback

---

## 4. Well Track Contract

### 4.1 Stratigraphy Track

`track-strat` is a single discrete track with two vertical lanes inside one graph:

- left lane = `System`
- right lane = `Age`

Current meaning:

- this track displays the loaded well stratigraphy as-is
- it represents the stratigraphic intervals currently attached to the selected well
- it is not yet required to be normalized against a canonical stratigraphy dictionary

Rules:

- both lanes represent the same loaded well intervals
- both lanes are derived from the same well stratigraphy payload
- later, these intervals may be linked to canonical stratigraphy dictionary entries
- dictionary binding is an enrichment step, not the current source of the rendered track
- merging the lanes into one track does not change the future dictionary or tops integration contract

### 4.2 Discrete vs Continuous Rendering

Rendering rules:

- `track-strat` is a discrete interval track
- `track-lithology` is a discrete interval track
- `track-log` is a continuous curve track
- `track-depth` is a scale-only track

Discrete interval tracks must render categorical blocks by depth interval.
They are not treated as continuous logs.

Later enrichment model:

- loaded well stratigraphy remains the display source
- strat dictionary provides canonical metadata, hierarchy, ages, and colors
- dictionary mapping enriches the loaded intervals instead of replacing the well-local input contract

---

## 5. Syncable Graph Contract

### 5.1 Sync Targets

The current sync targets are:

- `burial-multi`
- `burial-selected`
- `track-strat`
- `track-lithology`
- `track-log`
- `track-depth`

### 5.2 Source Selection

The viewport source is determined only by the graph that actually triggered the callback.

Implementation rule:

- use `dash.ctx.triggered_id`
- do not use fallback logic such as `multi_relay or selected_relay`

### 5.3 Reset Behaviour

If the active source graph emits a double-click reset / autorange event:

- the default viewport is restored
- the restored viewport is written to `depth-viewport`
- all sync targets receive the same reset when sync is enabled

Default viewport:

```json
{ "r0": 2500.0, "r1": 0.0 }
```

---

## 6. `Sync charts` Behaviour

### 6.1 Component

- component type: `dbc.Button`
- component id: `sync-scales-toggle`
- label: `Sync charts`

### 6.2 OFF State

When `sync-enabled = false`:

- all burial and well-track graphs are independent
- zoom/pan on one graph must not modify any other graph
- user interaction still updates the shared `depth-viewport` candidate
- clientside apply callbacks must not call `Plotly.relayout` on other views

Expected result:

- each graph lives its own life
- the most recently changed graph defines the candidate viewport for a later sync

### 6.3 ON State

When `sync-enabled = true`:

- any syncable graph may become the source
- the last graph the user actually moved becomes the source
- the current `depth-viewport` is applied immediately when sync is turned ON
- after that, any new source graph writes its Y range to `depth-viewport`
- the shared viewport is applied to every other sync target

Expected result:

- pressing `Sync charts` aligns all views immediately to the last active viewport
- moving any one of the six graphs updates the other five

### 6.4 Visual State

The button must show explicit mode state:

- OFF -> secondary / outline appearance
- ON -> primary / filled appearance

This button is a persistent mode toggle, not a one-shot action.

---

## 7. Callback Contract

### 7.1 Server Callback Responsibilities

Server-side sync code is responsible for:

- toggling `sync-enabled`
- detecting which syncable graph triggered the event
- parsing `relayoutData` from the triggered graph only
- writing the new Y viewport to `depth-viewport`

### 7.2 Clientside Callback Responsibilities

Clientside sync code in `assets/sync_scales.js` is responsible for:

- reading `depth-viewport`
- reading `sync-enabled`
- applying the viewport to all sync targets when sync is enabled
- doing nothing when sync is disabled
- re-applying the current `depth-viewport` when `sync-enabled` switches from `false` to `true`

### 7.3 One-Way Rule

There is one shared viewport state only:

- graph interaction -> `depth-viewport`
- `depth-viewport` -> graph relayout

There must not be multiple competing shared viewport states.

---

## 8. Required Behaviour Scenarios

### 8.1 Independent Mode

Given:

- `sync-enabled = false`

Then:

- drag `burial-multi` -> every other graph stays unchanged
- drag `burial-selected` -> every other graph stays unchanged
- drag any well track -> all other graphs stay unchanged

### 8.2 Shared Mode

Given:

- `sync-enabled = true`

Then:

- drag `burial-multi` -> every other graph follows
- drag `burial-selected` -> every other graph follows
- drag any well track -> every other graph follows

### 8.3 Mode Switch

Given:

- user worked independently with sync OFF

When:

- user turns sync ON

Then:

- all graphs align immediately to the last active `depth-viewport`
- no extra drag is required to trigger the first alignment

---

## 9. Current File Ownership

Files responsible for this contract:

- `app/src/subsidence/viz/layout/__init__.py`
- `app/src/subsidence/viz/layout/sidebar.py`
- `app/src/subsidence/viz/layout/burial_panel.py`
- `app/src/subsidence/viz/layout/well_log_panel.py`
- `app/src/subsidence/viz/callbacks/sync.py`
- `app/src/subsidence/viz/callbacks/well_log.py`
- `app/src/subsidence/viz/assets/sync.js`
- `app/src/subsidence/viz/assets/sync_scales.js`
- `app/src/subsidence/viz/plotting/well_log.py`

---

## 10. Immediate Implementation Focus

1. Keep the merged `track-strat` stable as a two-lane discrete track.
2. Keep `track-lithology`, `track-log`, and `track-depth` as independent graphs.
3. Keep `Sync charts` as the ON/OFF propagation gate.
4. Continue using `ctx.triggered_id` for source detection.
5. Move from demo well data to real loaded data in a later phase.

---

## 11. Out of Scope for This Step

The following are not part of this track merge:

- real tops-driven stratigraphy generation
- object manager implementation
- pick mode
- geology calculations
- final visual polish of test plots
