# Phase 3 Cleanup Contract

**Purpose**: stabilize the current Phase 3 implementation before adding more interaction features.
This cleanup contract records the agreed rules for save behavior, hydration, built-in
stratigraphy handling, per-well visualization settings, frontend state ownership, and backend/API
normalization needed to continue Compass implementation safely.

**Status**: complete (2026-04-20)

---

## Why this contract exists

The current `Phase 3` codebase already contains a large amount of UI and interaction logic:

- project dialogs and project toolbar actions
- independent well/data import flows
- project-wide `Data Manager`
- typed `Settings` inspector
- active stratigraphic chart switching
- per-well viewer composition state
- track/object selection logic

However, several behaviors are still transitional:

- save/autosave semantics are mixed
- `App.tsx` carries too much orchestration logic
- project-wide wells are not yet fully hydrated consistently
- built-in ICS behavior is not yet formally frozen
- some inspector editors affect only temporary frontend state
- some object types still need explicit "not implemented yet" handling
- chart APIs still carry legacy/transitional semantics

This contract defines the stabilization layer that must be completed before additional Compass
features are added.

---

## Scope of this cleanup

This cleanup is intended to be the last foundational stabilization pass before continuing Compass
interaction work. It is explicitly allowed to:

- refactor frontend state ownership
- move logic between stores/components
- normalize API semantics
- freeze persistence rules
- clean up legacy or transitional endpoints and UI flows
- update docs/checklists to truthful status

It is explicitly **not** intended to:

- add new geoscience features beyond what is required to stabilize existing Phase 3 flows
- redesign the product interaction model again
- postpone core cleanup items into later phases

---

## Agreed product decisions

### 1. Save model

There are two save classes:

**Autosave actions**
- data import
- data deletion

These actions persist immediately to the canonical project database.

**Explicit save actions**
- moving formation tops
- linking or unlinking tops
- editing top age / type / metadata
- well metadata edits
- viewer composition changes
- track composition changes
- visual settings edits

These actions update the working project state and mark the project dirty. They become canonical
only after the user presses `Save project`.

### 1.A Persistence inventory

The persistence boundary must be explicit for every object class.

**Autosave data classes**
- imported LAS / CSV log data
- imported tops
- imported deviation
- imported stratigraphic charts
- deletion of imported data objects

**Dirty-until-save data classes**
- well metadata edits
- formation-top metadata edits
- formation-top depth changes
- formation link changes
- top age / type changes
- per-well track composition
- per-well object-to-track assignment
- per-well curve visual settings
- per-well visible tops selection

**UI-only local state**
- sidebar width
- top/bottom split ratio in `Data Manager`
- collapsed/expanded tree nodes
- selected row in `Data Manager`
- selected tab in top/bottom sidebar panes
- temporary drag-preview state

No implementation may keep an action in an implicit or hybrid category.

### 2. Undo coverage

All editable user actions that mutate data must be undoable, including:

- well metadata changes
- formation top edits
- top depth moves
- link / unlink actions
- track assignment changes, where technically feasible within the viewer state model

### 2.A Minimum undo boundary

Undo must cover at minimum:

- create/delete well
- well metadata edits
- create/delete top
- move top
- edit top metadata
- link/unlink top

If a mutation is intentionally not undoable, that exception must be explicit.

### 3. Data Manager hydration

`Data Manager` must show **all wells with all loaded data**, not only the active well.

This means the frontend must be able to render full inventories for every well in the open
project, including:

- well metadata summary
- LAS group and curve inventory
- tops inventory
- deviation presence / summary

### 3.A Hydration strategy

This cleanup chooses a clear strategy:

- well inventories are loaded for **all wells** in the open project
- this includes enough data to render the full `Data Manager` tree for every well
- active-well detail views may still use a richer payload, but the inventory layer must not depend
  on the active well

This is an **eager inventory hydration** policy, not a lazy-on-expand policy.

### 4. Built-in ICS chart

The built-in international stratigraphic chart is sourced from:

- `sample_data/ics_chart2023.csv`

Rules:

- it is treated as a protected built-in chart
- it cannot be deleted from the UI
- it must be verified against the current expected file contents during cleanup

### 4.A Built-in vs loaded strat charts

Stratigraphic charts are split into two product classes:

**Built-in chart**
- protected
- always available to the project
- cannot be deleted
- sourced from `sample_data/ics_chart2023.csv`

**Loaded charts**
- user-imported
- can be activated, replaced, and deleted
- participate in top linking and coloring

The UI and API must expose this distinction clearly instead of treating every chart identically.

### 5. Per-well visualization settings

Visualization settings are unique **per well**.

Viewer defaults for a new or empty well:

1. `Depth`
2. `Lithology`
3. `Curve`

These defaults are the baseline track order unless the user changes the composition.

### 5.A Per-well visual-config boundary

Per-well visual configuration must cover at minimum:

- track list
- track order
- track widths
- track titles
- object assignment to tracks
- per-track visible curve set
- per-curve style overrides
- visible top set for the well
- lithology / curve / depth ordering defaults and user overrides

This configuration is scoped to a single well and must not bleed into other wells.

### 6. Track lifecycle

Track deletion is destructive:

- deleting a track removes it completely
- deleted tracks are not merely hidden placeholders

### 7. Settings inspector fallback

If an object type has no implemented editor yet, `Settings` must show:

- an empty state
- the object type name
- a note that settings for this object are not implemented yet

The missing object-type coverage list will be tracked explicitly.

### 7.A Current inspector coverage policy

During cleanup, every selectable object type must fall into exactly one category:

- `editable`
- `statistics-only`
- `empty-state / not implemented yet`

The UI must not expose mixed half-editable forms without an explicit category.

### 8. Project overwrite

Creating a project with overwrite enabled replaces the existing bundle completely.

No extra bundle-shape safety restriction is required at product level for this phase.

---

## Status audit requirements

Before more feature work continues, the project must produce a truthful audit of Phase 3 state:

- what is implemented
- what is partially implemented
- what is still only contractual
- which parts are transitional or temporary

This audit must update:

- `docs/phase3-contract.md`
- optionally `todo.md` if checkpoint sequencing changed

No future implementation should continue against stale progress tables.

---

## Cleanup goals

### Goal A - normalize Phase 3 state model

The code must separate clearly between:

- loaded project data
- active / selected well
- selected object in `Data Manager`
- selected track
- per-well viewer composition
- persisted visual configuration
- temporary UI-only state

### Goal B - normalize save behavior

Every action must belong to exactly one category:

- autosave
- dirty-until-save
- UI-only local state

No action should remain ambiguous.

### Goal C - stabilize project-wide wells inventory

The sidebar must be able to display full well inventories for all wells without relying on
"active well only" assumptions.

### Goal D - reduce frontend coupling

`frontend/src/App.tsx` must be refactored into smaller units so future Compass work does not stack
more orchestration into one component.

### Goal E - make object identity explicit

All selected/editable/visualized objects must have unambiguous identity contracts so selection,
inspector routing, undo, and persistence use the same keys.

### Goal F - make failure behavior predictable

Project open, hydration, save, delete, and strat-chart operations must produce predictable partial
or failed states instead of silent disappearance or half-updated UI.

---

## Required frontend architecture cleanup

### 1. Split `App.tsx`

The current orchestration in `frontend/src/App.tsx` must be broken into dedicated modules:

- `ProjectToolbar`
- `DataManagerPane`
- `SettingsInspector`
- `ViewerWorkspace`
- optional layout/splitter hook or module

The split must remove orchestration responsibilities from `App.tsx`, not merely move JSX around.

### 2. Centralize selection/composition state

The following state must stop living ad-hoc in component-local logic:

- selected object
- selected track
- per-well viewer composition
- per-well object visibility

Minimum explicit state groups:

- active project session state
- active well state
- selected object state
- selected track state
- per-well viewer composition state
- per-well visual settings state
- local-only layout state

### 3. Separate inspector state from visual-config persistence

`Settings` editors may update:

- persisted per-well visual state
- persisted per-well data state
- UI-only preview state

These categories must be separated explicitly so the user can predict what requires `Save project`.

### 4. Build a real object inspector contract

`Settings` must act as a true typed inspector, not a mixed summary panel.

Required inspector behavior:

- one selected object at a time
- typed rendering based on object kind
- explicit empty state when unsupported
- no hidden dependence on checkbox/radio visibility state

### 5. Restore track-lifecycle ownership

Track lifecycle operations belong to the viewer/settings domain and must be represented explicitly:

- create track
- assign object to selected track
- create new track when no track is selected
- delete track completely
- reorder tracks

If a track-lifecycle action is not implemented yet, it must be absent or explicitly disabled, not
silently lost.

---

## Required backend cleanup

### 1. Save/dirty consistency

Backend mutations must be classified as:

- autosave mutations
- dirty-only mutations

This must be visible in the API/service layer and not left implicit.

### 1.A Save semantics by endpoint

Each mutating endpoint or service action must document internally whether it:

- autosaves immediately
- marks dirty only
- updates working state only

This classification must be discoverable from code, not only from docs.

### 2. Undo consistency

API-backed mutation flows that edit canonical well/top metadata must be wired through undo where
the product contract says undo is required.

### 3. Well metadata validation

Well metadata updates need explicit validation policy, including at minimum:

- numeric parsing
- non-negative depth handling
- empty-name handling
- `KB`, `GL`, `TD` coherence
- coordinate parsing consistency
- blank CRS handling

### 4. Built-in ICS verification

The cleanup pass must verify that `sample_data/ics_chart2023.csv` is the chart currently used as
the protected built-in reference and that chart import/activation logic does not silently drift
away from it.

### 5. Legacy route cleanup

Legacy or transitional strat-chart routes must be normalized.

Cleanup must decide and implement:

- canonical plural vs singular route naming
- whether delete-all chart routes remain available internally only
- which routes are product-facing and which are compatibility shims

### 6. API summary layer for project-wide wells

If full well payloads are too heavy for the sidebar tree, cleanup must introduce an explicit
summary/inventory API layer rather than continue relying on active-well payload reuse.

---

## Object identity and inspector coverage

### Object identity contract

Every selectable object must have stable identity at UI and persistence boundaries.

Minimum identities:

- `well` -> `well_id`
- `las_group` -> `well_id + source_key`
- `curve` -> `well_id + source_key + mnemonic`
- `tops_group` -> `well_id + group_key`
- `top_pick` -> `formation_id`
- `strat_chart` -> `chart_id`
- `deviation` -> `well_id + deviation_key`

The cleanup implementation must avoid relying on row order or label text as identity.

### Implemented or partially implemented inspector object types

- `well`
- `las_group`
- `curve`
- `tops_group`
- `top_pick`
- `strat_chart`

### Missing or incomplete inspector object types to track explicitly

- `deviation`
- `track`
- `model`
- any future overlay entity

### Explicitly allowed empty-state objects during cleanup

Any object type without a complete editor may remain statistics-only or empty-state, but the UI
must say so explicitly instead of exposing half-working controls.

---

## Data Manager rules to preserve

- all wells visible in one project-wide tree
- wells use radio behavior
- curves / tops / deviation use checkbox behavior
- collapse state is separate from selection state
- all nodes start collapsed by default on project open
- selected rows highlight independently of checkbox/radio state
- checkbox/radio controls do not break collapse/expand
- row selection does not imply visualization toggle
- non-active wells still show full inventory, not placeholders

### Data Manager layout rules to preserve

- left panel is split into a top zone and a bottom `Settings` zone
- outer vertical boundary is draggable
- internal horizontal split is draggable
- splitter positions are UI-local state unless later promoted
- `StratCharts`, `Wells`, and `Models` remain in the upper zone
- `Settings` remains in the lower zone

### Data Manager row simplification rules

- inventory rows stay compact
- object detail noise is minimized in the tree
- details move to `Settings`
- group rows may expose tri-state selection where needed (`LAS`, `TOPS`)

---

## Strat chart rules to preserve

- one active chart at a time
- built-in ICS is protected and non-deletable
- loaded charts remain user-manageable
- top coloring follows the active chart when a link exists
- fallback color for unlinked tops remains medium gray
- switching the active chart must not destroy unrelated viewer composition state
- deleting a loaded chart must not affect the built-in ICS
- built-in ICS must always remain activatable

### Top-linking policy to preserve

- tops are well-local picks first
- linking to a strat chart is optional enrichment
- the active chart controls displayed color and linked-name enrichment
- absence of a link is a valid steady state

---

## Failure handling contract

### Project open failures

If part of project hydration fails:

- project open must not silently succeed with empty UI
- the user must see which part failed
- successfully loaded wells/charts may remain visible only if the failure is explicitly marked as
  partial

### Sidebar hydration failures

If one well inventory fails to hydrate:

- that well node must show an error state
- other wells remain usable
- the whole project tree must not disappear

### Save failures

If explicit `Save project` fails:

- dirty state must remain dirty
- no UI should falsely indicate successful persistence
- the user must be able to retry save without redoing changes

### Autosave failures

If an autosave mutation fails:

- the operation must not look committed in the canonical state
- the user must see a failure state
- local UI should not silently diverge forever from backend state

### Strat-chart failures

If chart activation, import, or deletion fails:

- active chart state must remain consistent
- top coloring must not fall into an undefined mixed state

---

## Verification matrix

Cleanup is not complete until the following flows pass:

### Project/session flows

- create project
- overwrite existing project
- open recent project
- close project without saving dirty viewer edits
- reopen and verify dirty-only edits are gone
- save project and reopen and verify dirty-only edits are preserved

### Well/data flows

- open project with at least two wells
- verify both wells show complete inventories in `Data Manager`
- switch active well from `Wells` tree
- verify non-active well inventory remains visible
- create empty well
- import tops before LAS
- import deviation before LAS
- import LAS with auto-create

### Editor flows

- edit well metadata
- undo well metadata edit
- move top
- undo top move
- link/unlink top
- delete well
- delete track completely

### Strat-chart flows

- built-in ICS is present
- built-in ICS cannot be deleted
- load a second chart
- activate loaded chart
- verify colors switch
- delete loaded chart
- verify built-in ICS remains intact

### Save/autosave flows

- import data and verify immediate canonical persistence
- edit viewer settings and verify dirty-only behavior
- press `Save project` and verify persistence after reopen

### UI stability flows

- drag vertical sidebar splitter
- drag horizontal sidebar splitter
- reload project and verify splitters are allowed to reset as UI-local state
- verify all `Data Manager` nodes start collapsed
- verify radios/checkboxes do not break collapse

---

## Implementation checkpoints inside cleanup

### Cleanup Step 1 - Status and semantics audit ✅

- `docs/phase3-audit.md` written with factual snapshot
- save/autosave/dirty semantics audited and normalized (`dbec34e`)
- inspector editor categories audited

### Cleanup Step 2 - Project-wide hydration ✅

- `WellInventory` type + `GET /api/wells/inventory` endpoint
- `loadWellInventories()` store action with eager hydration on project open
- `WellDataPanel` updated to show all wells, not just active well

### Cleanup Step 3 - State ownership refactor ✅

- `App.tsx` split: 1219 lines → 165 lines
- `ProjectToolbar` — dialog state, all toolbar action handlers, keyboard shortcuts
- `DataManagerPane` — sidebar tabs, selection/toggle handlers, Settings inspector
- `ViewerWorkspace` — log view rendering, computed track/formation data
- `useSidebarResize` hook extracted
- `refreshWell()` store action centralizes post-mutation well reload logic

### Cleanup Step 4 - Inspector normalization ✅

- `SettingsInspector` extracted to standalone component (`15955f1`)
- explicit coverage categories: `well`, `las-group`, `curve`, `tops-group`, `top-pick`, `strat-chart`
- explicit empty state for unselected, not-yet-loaded, and unsupported object types
- unsupported types (`deviation`, `track`, `model`) fall through to explicit "not implemented yet" message

### Cleanup Step 5 - Strat-chart hardening ✅

- built-in ICS detection via `_is_builtin_chart()` helper (`42d051c`)
- `DELETE /api/strat-charts/{id}` returns 403 for built-in chart
- `_normalize_builtin_chart()` in seeder repairs name/path drift on project open
- frontend delete button disabled for `is_builtin` charts
- legacy `POST /api/strat-chart/import` route removed; canonical route is `POST /api/strat-charts/import`
- `DELETE /api/strat-chart` (delete-all) removed; per-chart deletion is the only product-facing operation

### Cleanup Step 6 - Verification pass ✅ (docs)

- `docs/phase3-contract.md` progress table updated to truthful status
- `docs/phase3-cleanup-contract.md` status updated
- manual verification matrix execution required before deeper Compass work

---

## Deliverables of this cleanup

At the end of cleanup, the repository must contain:

- a truthful `Phase 3` status document
- a stable save/autosave model
- a project-wide hydrated `Data Manager`
- a reduced-responsibility `App.tsx`
- a typed `Settings` inspector with explicit empty states
- protected built-in ICS behavior
- a documented verification baseline for future Compass work

---

## Execution order for cleanup

1. Audit and normalize `Phase 3` status against actual code
2. Freeze save/autosave/dirty policy in code
3. Implement full project-wide well hydration for `Data Manager`
4. Refactor `App.tsx` into smaller modules
5. Move selection/composition state into explicit stores/modules
6. Normalize `Settings` into a true typed inspector with explicit empty states
7. Verify built-in ICS and lock its delete behavior
8. Only then continue with deeper Compass interactions

---

## Exit criteria for this cleanup contract

Cleanup is complete when:

- `Phase 3` status is truthful in docs
- project open shows complete data inventories for all wells
- save behavior is predictable and documented in code
- well metadata edits are undoable
- built-in ICS is protected and verified
- `App.tsx` is no longer the main architectural bottleneck
- `Settings` clearly separates implemented editors from not-yet-implemented object types
- the verification matrix passes without ad-hoc manual recovery steps
