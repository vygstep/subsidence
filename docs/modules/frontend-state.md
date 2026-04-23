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

Common bug areas:

- Project opens but visual config is not hydrated.
- Save succeeds but reopen loses data.
- Recent projects are stale.

---

## `wellDataStore`

Owns:

- Active well data.
- Curves and formations for the active well.
- Well inventories.
- Formation CRUD and depth drag updates.
- Well metadata patching.

Common bug areas:

- Data from previous well remains after switching.
- Imported curves do not show in inventory.
- Formation updates are optimistic but not persisted.

---

## `workspaceStore`

Owns:

- Per-well viewer state.
- Track list/order/widths.
- Visible curves.
- Track and curve template settings.

Common bug areas:

- Curves disappear after switching wells.
- Wrong track order after save/reopen.
- Default tracks are created incorrectly.

---

## `viewStore`

Owns:

- Selected object.
- Active Data Manager panel.
- Zoom, scroll, and visible depth range.
- Selected track/formation/UI mode.

Common bug areas:

- Settings pane shows the wrong object.
- Selection remains after object deletion.
- Layout scroll state leaks between panes.

---

## `computedStore`

Owns:

- Subsidence calculation state.
- WebSocket recalculation lifecycle.
- Subsidence display toggles.
- Water depth and related calculation inputs.

Common bug areas:

- Recalculation does not trigger.
- Stale result remains after input changes.
- WebSocket error is not visible enough.

---

## `multiWellStore`

Owns:

- Multi-well/subsidence workspace state.
- Cross-well panel behavior.

Common bug areas:

- Subsidence panel is blank.
- Multi-well selection does not match Data Manager state.
