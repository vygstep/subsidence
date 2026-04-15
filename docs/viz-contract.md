# SUBSIDENCE - Visualization Contract

> This document is the authoritative contract for the Dash visualization layer.
> UI behaviour is agreed here first, then implemented in code.

---

## 1. Scope

This contract covers the current 1D modelling UI only:

- the two burial summary views
- the well view
- shared vertical scale behaviour
- the `Sync charts` control

It does not define calculation logic or real geological results yet. Current plots are still a test plotting layout.

---

## 2. Current Views

The current 1D screen contains three syncable views:

1. `burial-multi`
   Multi-well comparison chart.
2. `burial-selected`
   Selected-well burial chart.
3. `well-figure`
   Well view / well data chart.

All three views use depth on the Y axis, positive downward.

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

- `false` = all syncable views are independent
- `true` = all syncable views share the same Y viewport

Written by:

- `Sync charts` toggle button

Read by:

- server sync callbacks
- clientside viewport-apply callback

---

## 4. Syncable Graph Contract

### 4.1 Sync Targets

The current sync targets are:

- `burial-multi`
- `burial-selected`
- `well-figure`

Any later per-track well graphs may subscribe to the same contract, but current implementation must first make these three views correct.

### 4.2 Source Selection

The viewport source is determined only by the graph that actually triggered the callback.

Implementation rule:

- use `dash.ctx.triggered_id`
- do not use fallback logic such as `multi_relay or selected_relay`

### 4.3 Reset Behaviour

If the active source graph emits a double-click reset / autorange event:

- the default viewport is restored
- the restored viewport is written to `depth-viewport`
- all sync targets receive the same reset when sync is enabled

Default viewport:

```json
{ "r0": 2500.0, "r1": 0.0 }
```

---

## 5. `Sync charts` Behaviour

### 5.1 Component

- component type: `dbc.Button`
- component id: `sync-scales-toggle`
- label: `Sync charts`

### 5.2 OFF State

When `sync-enabled = false`:

- `burial-multi`, `burial-selected`, and `well-figure` are independent
- zoom/pan on one graph must not modify any other graph
- user interaction still updates the shared `depth-viewport` candidate
- clientside apply callbacks must not call `Plotly.relayout` on other views

Expected result:

- each graph lives its own life
- the most recently changed graph defines the candidate viewport for a later sync

### 5.3 ON State

When `sync-enabled = true`:

- any syncable graph may become the source
- the last graph the user actually moved becomes the source
- the current `depth-viewport` is applied immediately when sync is turned ON
- after that, any new source graph writes its Y range to `depth-viewport`
- the shared viewport is applied to every other sync target

Expected result:

- pressing `Sync charts` aligns all views immediately to the last active viewport
- moving any one of the three views updates the other two

### 5.4 Visual State

The button must show explicit mode state:

- OFF -> secondary / outline appearance
- ON -> primary / filled appearance

This button is a persistent mode toggle, not a one-shot action.

---

## 6. Callback Contract

### 6.1 Server Callback Responsibilities

Server-side sync code is responsible for:

- toggling `sync-enabled`
- detecting which syncable graph triggered the event
- parsing `relayoutData` from the triggered graph only
- writing the new Y viewport to `depth-viewport`

Server-side sync code is not responsible for:

- directly forcing all other graphs to redraw one by one if clientside relayout can do it cleanly

### 6.2 Clientside Callback Responsibilities

Clientside sync code in `assets/sync_scales.js` is responsible for:

- reading `depth-viewport`
- reading `sync-enabled`
- applying the viewport to all sync targets when sync is enabled
- doing nothing when sync is disabled
- re-applying the current `depth-viewport` when `sync-enabled` switches from `false` to `true`

### 6.3 One-Way Rule

There is one shared viewport state only:

- graph interaction -> `depth-viewport`
- `depth-viewport` -> graph relayout

There must not be multiple competing shared viewport states.

---

## 7. Required Behaviour Scenarios

### 7.1 Independent Mode

Given:

- `sync-enabled = false`

Then:

- drag `burial-multi` -> `burial-selected` and `well-figure` stay unchanged
- drag `burial-selected` -> `burial-multi` and `well-figure` stay unchanged
- drag `well-figure` -> both burial charts stay unchanged

### 7.2 Shared Mode

Given:

- `sync-enabled = true`

Then:

- drag `burial-multi` -> `burial-selected` and `well-figure` follow
- drag `burial-selected` -> `burial-multi` and `well-figure` follow
- drag `well-figure` -> both burial charts follow

### 7.3 Mode Switch

Given:

- user worked independently with sync OFF

When:

- user turns sync ON

Then:

- all three views align immediately to the last active `depth-viewport`
- no extra drag is required to trigger the first alignment

---

## 8. Current File Ownership

Files responsible for this contract:

- `app/src/subsidence/viz/layout/__init__.py`
- `app/src/subsidence/viz/layout/sidebar.py`
- `app/src/subsidence/viz/layout/burial_panel.py`
- `app/src/subsidence/viz/callbacks/sync.py`
- `app/src/subsidence/viz/assets/sync.js`
- `app/src/subsidence/viz/assets/sync_scales.js`

Related figure callbacks:

- `app/src/subsidence/viz/callbacks/burial.py`

---

## 9. Immediate Implementation Plan

1. Keep `depth-viewport` updated from whichever syncable graph the user changed last.
2. Keep `Sync charts` as the ON/OFF propagation gate.
3. Apply the current `depth-viewport` immediately when sync is turned ON.
4. Continue using `ctx.triggered_id` for source detection.
5. Verify immediate alignment and subsequent shared dragging in the running app.

---

## 10. Out of Scope for This Fix

The following are not part of this sync fix:

- per-track well-log graph split
- pick mode
- stratigraphy editing
- geology calculations
- final visual polish of test plots
