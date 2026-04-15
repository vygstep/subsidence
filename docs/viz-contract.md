# SUBSIDENCE - Visualization Contract

> This document is the authoritative contract for the Dash visualization layer.
> UI behaviour is agreed here first, then implemented in code.

---

## 1. Scope

This contract covers the current 1D modelling UI only:

- the two burial summary views
- the well view
- shared vertical scale behaviour
- the `Sync scales` control

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

- this is the single source of truth for the shared Y viewport
- it is written only from real user interaction on a syncable graph
- it is never inferred from stale `relayoutData` of another graph

### 3.3 `sync-enabled`

```json
false
```

Meaning:

- `false` = all syncable views are independent
- `true` = all syncable views share the same Y viewport

Written by:

- `Sync scales` toggle button

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

When sync is enabled, the viewport source is determined only by the graph that actually triggered the callback.

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

## 5. `Sync scales` Behaviour

### 5.1 Component

- component type: `dbc.Button`
- component id: `sync-scales-toggle`
- label: `Sync scales`

### 5.2 OFF State

When `sync-enabled = false`:

- `burial-multi`, `burial-selected`, and `well-figure` are independent
- zoom/pan on one graph must not modify any other graph
- user interaction may still update that graph locally
- shared apply callbacks must not call `Plotly.relayout` on other views

Expected result:

- each graph lives its own life

### 5.3 ON State

When `sync-enabled = true`:

- any syncable graph may become the source
- the last graph the user actually moved becomes the source
- that graph writes its Y range to `depth-viewport`
- the shared viewport is applied to every other sync target

Expected result:

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

Clientside sync code in `assets/sync.js` is responsible for:

- reading `depth-viewport`
- reading `sync-enabled`
- applying the viewport to all sync targets only when sync is enabled
- doing nothing when sync is disabled

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

- the next user interaction on any syncable graph becomes the source of truth
- after that interaction, all three views become aligned

---

## 8. Current File Ownership

Files responsible for this contract:

- `app/src/subsidence/viz/layout/__init__.py`
- `app/src/subsidence/viz/layout/burial_panel.py`
- `app/src/subsidence/viz/callbacks/sync.py`
- `app/src/subsidence/viz/assets/sync.js`

Related figure callbacks:

- `app/src/subsidence/viz/callbacks/burial.py`

---

## 9. Immediate Implementation Plan

1. Add `dcc.Store(id="sync-enabled", data=False)` to the layout.
2. Replace the current mislabeled `fit-to-subsidence` behaviour with a true `Sync scales` toggle.
3. Rewrite `callbacks/sync.py` so the source graph is chosen via `ctx.triggered_id`.
4. Allow all three current views to participate in the shared viewport contract.
5. Update `assets/sync.js` so viewport application is gated by `sync-enabled`.
6. Verify the six scenarios from Section 7 manually in the running app.

---

## 10. Out of Scope for This Fix

The following are not part of this sync fix:

- per-track well-log graph split
- pick mode
- stratigraphy editing
- geology calculations
- final visual polish of test plots
