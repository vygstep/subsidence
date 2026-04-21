# Phase 3 Cleanup 2 Contract

**Purpose**: close the remaining Phase 3 architecture, consistency, and verification gaps
after the first cleanup pass, so Phase 4 can start on a stable UI and persistence base.

**Status**: proposed

---

## Why this contract exists

`Phase 3` is no longer in an early prototype state. The repository already contains:

- project/session dialogs
- project-wide `Data Manager`
- typed `Settings` inspector
- protected built-in ICS chart handling
- per-well viewer state
- toolbar-driven well / tops / strat-chart actions
- normalized save/autosave behavior for core data flows

However, the implementation is still not fully hardened:

- `docs/phase3-contract.md` is no longer a truthful implementation ledger
- `App.tsx` is smaller than before but still carries orchestration-heavy logic
- `DataManagerPane.tsx` is the next oversized frontend bottleneck
- `Load logs` still means LAS-only instead of LAS + CSV
- per-well viewer composition persistence is still not fully closed
- some settings still affect frontend composition only, not canonical persisted visual state
- browser-level verification is still partial
- several small API/store semantics are stable in practice but not yet frozen as final product rules

This contract defines the second and final stabilization pass for Phase 3.

---

## Baseline audit conclusions

The following statements are treated as factual starting conditions:

1. `docs/phase3-cleanup-contract.md` is currently the most truthful Phase 3 contract.
2. `docs/phase3-verification.md` is the most truthful verification snapshot.
3. `docs/phase3-audit.md` is historical and must not be treated as the current source of truth.
4. `docs/phase3-contract.md` is still useful as a roadmap reference, but it is stale as a progress ledger and also contains encoding corruption.
5. The remaining risk is no longer a single blocking bug; it is the accumulation of architectural and semantic drift.

---

## Required outcomes

Cleanup 2 is complete only when all of the following are true:

1. `Phase 3` docs are internally consistent and readable.
2. `Load logs` is a real unified action for LAS and CSV.
3. per-well viewer composition and visual settings have an explicit persisted boundary.
4. `App.tsx` is reduced to app wiring, not feature orchestration.
5. `DataManagerPane.tsx` is split into smaller units with clearer responsibilities.
6. `Settings` editors that claim to modify visualization do so through a defined persistence model.
7. `X/Y` metadata semantics are explicit and no longer implicitly disguised `lon/lat`.
8. browser-level verification covers the agreed Phase 3 matrix.

---

## Scope

This cleanup pass is allowed to:

- update Phase 3 docs
- refactor frontend component boundaries
- move state between stores/components
- add or normalize persistence APIs
- normalize metadata semantics
- add missing CSV log-import flow
- add verification and failure-handling coverage

This cleanup pass is not intended to:

- introduce Phase 4 overlay/cursor/drag features
- redesign the Phase 3 interaction model again
- change agreed save/autosave product rules from Cleanup 1

---

## Workstream A - documentation truthfulness

### A1. Phase 3 contract normalization

`docs/phase3-contract.md` must be reduced to one of these roles:

- a truthful progress ledger aligned with current code,
or
- an explicitly historical roadmap document with a clear note that cleanup docs supersede it

It must not remain ambiguous.

### A2. Encoding repair

The mojibake visible in `docs/phase3-contract.md` must be removed.

Examples currently present:

- `вЂ”`
- `в†’`

The document must become clean UTF-8 text again.

### A3. Progress-table truthfulness

Every step in `docs/phase3-contract.md` must be placed into one category:

- `done`
- `partial`
- `pending`
- `superseded by cleanup`

No step may remain “green” if the code and verification docs do not support it.

### A4. Verification linkage

`docs/phase3-contract.md` must point explicitly to:

- `docs/phase3-cleanup-contract.md`
- `docs/phase3-cleanup2-contract.md`
- `docs/phase3-verification.md`

so there is a single clear chain:

`roadmap -> cleanup decisions -> verification`

---

## Workstream B - frontend architecture hardening

### B1. `App.tsx` boundary

`frontend/src/App.tsx` must stop carrying feature-level orchestration beyond:

- project open/closed gating
- global hydration bootstrap
- global status polling
- global keyboard shortcuts
- high-level layout composition

The following concerns must not remain embedded there long-term:

- selected-object bridge logic
- per-feature hydration branching
- feature-specific persistence save timers
- active-well re-selection heuristics

### B2. `DataManagerPane.tsx` split

`frontend/src/components/layout/DataManagerPane.tsx` must be split into smaller components.

Minimum target split:

- `DataManagerTabs`
- `WellInventoryTree`
- `StratChartsPane`
- `SettingsPaneShell`
- `WellInspectorController` or equivalent interaction adapter

The goal is to separate:

- tree rendering
- tree action handlers
- viewer composition handlers
- inspector data wiring

### B3. Stable store ownership

State ownership must become explicit:

**`projectStore`**
- project session
- dirty/undo/redo/save status
- canonical visual-config API state

**`wellDataStore`**
- canonical loaded data
- inventories for all wells
- active-well rich payload
- chart payloads

**`workspaceStore`**
- UI-local workspace state
- selected object
- active sidebar tab
- active toolbar mode
- split positions
- temporary per-well composition draft state, if still not canonical

**`viewStore`**
- rendering-related viewport state
- current cursor / zoom / selected element for the viewer

No state may remain “owned by convenience”.

---

## Workstream C - persistence boundary completion

### C1. Canonical per-well visual configuration

The project must explicitly decide and implement which per-well viewer settings persist canonically.

Minimum persisted set:

- track list
- track order
- track titles
- track widths
- visible/assigned curves per track
- visible tops set
- visible deviation state
- per-curve visual settings that are editable in `Settings`

### C2. UI-only state exclusions

The following remain UI-only and must not leak into canonical visual config:

- sidebar width
- sidebar split ratio
- tree collapsed/expanded state
- selected row
- active sidebar tab
- temporary drag preview state

### C3. Save behavior for viewer settings

Any persisted viewer configuration change must follow the agreed save rule:

- update working state immediately
- mark project dirty
- become canonical only after `Save project`

No viewer-setting mutation may silently autosave unless explicitly reclassified.

### C4. Inspector truthfulness

If a `Settings` control changes only frontend draft state, that must be treated as a bug.

Any editable field shown in `Settings` must be in one of two categories:

- persists canonically through save flow
- intentionally local-only and visibly labeled as such

Invisible hybrid behavior is not allowed.

---

## Workstream D - log import completion

### D1. Unified `Load logs`

`Load logs` in the toolbar must actually cover:

- LAS
- CSV

This is already flagged as not done in `docs/phase3-contract.md`.

### D2. CSV log-import contract

CSV import must define:

- file selection/path input
- required columns
- depth column handling
- curve metadata defaults
- well-targeting / auto-create well behavior

### D3. Post-import viewer behavior

CSV logs must follow the same product rule as LAS:

- appear in `Data Manager`
- do not auto-mount into viewer tracks
- can be assigned to selected/new tracks by explicit user action

---

## Workstream E - metadata semantics cleanup

### E1. `X/Y` meaning

The current API exposes `x/y`, while backend storage still maps them onto `lon/lat`.

This must be normalized explicitly.

Allowed outcomes:

- rename storage fields in the schema later, while keeping API stable now
or
- document clearly that `x/y` are currently stored in legacy `lon/lat` columns but semantically mean project coordinates

What is not allowed:

- silent semantic mismatch with no documentation

### E2. Well settings validation

`PATCH /api/wells/{id}` must have at least basic numeric/domain validation for:

- `KB`
- `GL`
- `TD`
- `X`
- `Y`

Validation errors must be explicit and user-readable.

---

## Workstream F - Data Manager behavior hardening

### F1. Inventory consistency

`Wells` tree must continue to show all wells with all inventories after:

- project open
- save
- close + reopen
- undo/redo affecting wells or tops
- chart activation/deletion

### F2. Checkbox/view consistency

Tree checkbox state must reflect actual viewer composition immediately, without waiting for unrelated UI refresh.

This includes group toggles:

- `LAS`
- `TOPS`
- `DEV`

### F3. Selection consistency

Selecting an object in `Data Manager` must remain independent from:

- collapse/expand state
- radio/checkbox activation state
- active track state

This rule must survive refactors.

### F4. Object-type coverage matrix

The repository must maintain a clear coverage list for object types:

- `well`
- `las-group`
- `curve`
- `tops-group`
- `top-pick`
- `strat-chart`
- `deviation`
- `track`
- `model`

For each type, the code/docs must say:

- selectable?
- visualizable?
- editable?
- stats-only?
- not implemented?

---

## Workstream G - browser-level verification

### G1. Manual verification matrix

Phase 3 cannot be considered closed until manual browser verification covers at minimum:

1. Open project with 2 wells
2. Data Manager shows full inventories for both wells
3. Select well A, then well B, then back to A
4. Add curves from `LAS` to selected/new tracks
5. Toggle `TOPS` partially/all/none
6. Edit well metadata -> dirty state -> save -> close -> reopen -> value preserved
7. Move top -> dirty state -> save -> close -> reopen -> value preserved
8. Link/unlink top -> save -> close -> reopen -> state preserved
9. Activate imported chart -> colors switch correctly
10. Built-in ICS cannot be deleted
11. Delete imported chart -> links/colors fall back correctly
12. `Load logs` works for LAS and CSV

### G2. Failure matrix

Manual verification must also cover error handling:

- invalid project path
- invalid LAS path
- invalid CSV path
- invalid strat chart file
- invalid numeric edits in Settings
- deleting active well
- deleting last non-built-in chart

The UI must fail visibly, not silently.

---

## Workstream H - explicit remaining Phase 3 debt

The following items may remain after Cleanup 2 only if they are explicitly documented as deferred:

- overlay rendering (`Step 4+`)
- cursor/status-bar feature completeness
- drag-to-move top interaction loop
- curve click highlighting
- minimap

Everything else that belongs to Phase 3 foundation should be treated as cleanup debt, not future-feature debt.

---

## Execution order

Cleanup 2 must be executed in this order:

1. Documentation truthfulness and encoding cleanup
2. Persistence boundary completion
3. Unified `Load logs` completion
4. `App.tsx` / `DataManagerPane.tsx` component split
5. Metadata semantics cleanup
6. Full browser verification pass

This order is mandatory because later steps depend on earlier truthfulness and persistence rules.

---

## Exit criteria

Cleanup 2 is complete only when:

- docs are consistent and readable
- unified `Load logs` exists
- canonical per-well visual persistence is explicit and implemented
- `App.tsx` and `DataManagerPane.tsx` are no longer the dominant orchestration bottlenecks
- manual verification matrix is run and recorded
- remaining deferred items belong only to true Phase 4+ functionality
