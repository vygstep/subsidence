# Frontend State Module

This module describes Zustand store ownership.

---

## Store Ownership

Files:

- `frontend/src/stores/projectStore.ts`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/stores/workspaceStore.ts`
- `frontend/src/stores/viewStore.ts`
- `frontend/src/stores/multiWellStore.ts`
- `frontend/src/stores/computedStore.ts`

---

## `projectStore`

Owns:

- Project open/closed state.
- Project path and recent projects.
- Project create/open/save/close API calls.
- Visual config loading and persistence.
- Serialization helpers for project-level and per-well visual config.

Common bug areas:

- Project opens but visual config is not hydrated.
- Save succeeds but reopen loses data.
- Recent projects are stale.
- Track order or curve settings are not restored after reopen.

---

## `wellDataStore`

Owns:

- Active well data.
- Curves and formations for the active well.
- Well inventories.
- Formation CRUD and depth drag updates.
- Well metadata patching.
- Optimistic/debounced formation depth updates.

Common bug areas:

- Data from previous well remains after switching.
- Imported curves do not show in inventory.
- Formation updates are optimistic but not persisted.
- Pending depth patch survives well switch or reset.

---

## `workspaceStore`

Owns:

- Per-well viewer state.
- Track list/order/widths.
- Visible curves.
- Track and curve template settings.
- Canonical depth/formations/static track order.
- Coercion of persisted well view state during project load.

Common bug areas:

- Curves disappear after switching wells.
- Wrong track order after save/reopen.
- Default tracks are created incorrectly.
- Persisted visual config contains stale or malformed track state.

---

## `viewStore`

Owns:

- Selected object.
- Active Data Manager panel.
- Zoom, scroll, and visible depth range.
- Selected track/formation/UI mode.
- Sidebar/subsidence split dimensions.
- Depth track and formations track config.

Common bug areas:

- Settings pane shows the wrong object.
- Selection remains after object deletion.
- Layout scroll state leaks between panes.
- Resizer bounds or scroll container bugs move the whole app instead of the intended pane.

---

## `computedStore`

Owns:

- Subsidence calculation state.
- WebSocket recalculation lifecycle.
- Subsidence display toggles.
- Water depth and related calculation inputs.
- Compute timeout protection.

Common bug areas:

- Recalculation does not trigger.
- Stale result remains after input changes.
- WebSocket error is not visible enough.
- Calculation status remains stuck after a disconnect.

---

## `multiWellStore`

Owns:

- Multi-well/subsidence workspace state.
- Cross-well panel behavior.
- Stored results loaded from backend.

Common bug areas:

- Subsidence panel is blank.
- Multi-well selection does not match Data Manager state.
- Stored results and active well recalculation disagree.

---

## Store Refactor Rule

Do not move state between stores without first documenting:

- source owner
- target owner
- hydration path after project open
- save/reopen path if persisted
- tests that prove old state does not leak between wells/projects
