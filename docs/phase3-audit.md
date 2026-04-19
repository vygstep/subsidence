# Phase 3 Audit

**Purpose**: record the actual implementation state of Phase 3 at the start of cleanup.

This file is not a planning contract. It is a factual snapshot of what is already implemented,
what is partial, and what is still missing or inconsistent.

---

## Snapshot summary

### Done

- Phase 3 Step 1: visual config API + export endpoints
- Phase 3 Step 2: project selector UI (`New Project`, `Open Project`, recent projects)
- large practical subset of Step 2.5:
  - two-row toolbar
  - `Project`, `StratChart`, `Wells`, `Tops`, `Undo`, `Redo`
  - `Create well`, `Load logs`, `Load tops`, `Load deviation`
  - `Delete well`
  - empty well handling
  - overwrite flow for new project
  - left `Data Manager` with split panes and draggable boundaries
  - `StratCharts`, `Wells`, `Models`, `Settings`
  - `Wells` tree with radios / checkboxes / collapse
  - typed object inspector in `Settings`
  - active strat-chart switching
  - delete-active-chart flow

### Partial

- Step 2.5 save semantics:
  implemented, but mixed and not yet frozen as a consistent policy
- project-wide wells inventory:
  visible at root level, but not yet backed by a true eager all-well hydration model
- typed inspector:
  present, but some object editors are statistics-only or local-state-only
- strat-chart system:
  practical multi-chart behavior exists, but API/schema/contract terminology still drift

### Missing

- Phase 3 Steps 4–10 core interaction loop:
  - SVG interaction overlay
  - depth cursor
  - formation-line rendering
  - drag-to-move tops
  - tooltip/status bar
  - curve click highlight
  - minimap
- explicit project-wide well inventory API or cache model
- consistent undo coverage for every editable object class
- full frontend split of `App.tsx`

---

## Actual save semantics in code

### Autosave behavior

The following actions currently persist to canonical state immediately:

- `POST /api/projects/import-las`
- `POST /api/projects/import-tops`
- `POST /api/projects/import-unconformities`
- `POST /api/projects/import-deviation`
- strat-chart import flows

These flows call `manager.save_project()` directly in the backend after successful import.

### Dirty-only behavior

The following actions currently mark the project dirty instead of autosaving:

- `POST /api/projects/wells`
- `DELETE /api/projects/wells/{well_id}`
- `PATCH /api/wells/{well_id}`
- top edits driven through formations CRUD
- visual-config edits saved through explicit save flows and local store synchronization

### UI-local behavior

The following state is currently local-only:

- sidebar width
- sidebar split ratio
- collapse state in `WellDataPanel`
- selected row state in the object browser

### Current inconsistency

The project already implements the product direction:

- imports/deletes tend to autosave
- edits/settings tend to remain dirty until `Save project`

But the classification is not yet explicit in code and still needs normalization during cleanup.

---

## Frontend architecture audit

### `frontend/src/App.tsx`

Current responsibilities include:

- project session gating
- dialog orchestration
- toolbar mode orchestration
- well list refresh
- active well loading
- per-well viewer composition state
- selected object state
- selected top state
- selected track state wiring
- sidebar splitter state
- settings inspector rendering
- action handlers for wells / tops / charts / settings

This is the main frontend bottleneck and the highest-priority refactor target.

### `frontend/src/stores/projectStore.ts`

Good:

- project open/create/close flow exists
- recent projects exist
- status polling exists
- visual-config load/save exists

Weak points:

- save/autosave semantics are not encoded here as a product policy
- store still relies on `App.tsx` for too much hydration orchestration

### `frontend/src/stores/wellDataStore.ts`

Good:

- active well load exists
- formations CRUD exists
- chart activation/deletion refresh formation payloads

Weak points:

- store is still centered on one loaded well
- no true project-wide inventory cache exists yet

### `frontend/src/components/layout/WellDataPanel.tsx`

Good:

- project-wide well roots
- collapse/expand works independently of radio/checkbox controls
- tri-state group selection exists
- object selection exists

Weak points:

- full object inventory still depends on active-well payload assumptions
- tree is ahead of store architecture

### `Settings` inspector

Good:

- typed routing by selected object already exists
- `well`, `curve`, `top_pick`, and `strat_chart` have real panels

Weak points:

- some fields edit only local viewer state
- coverage is incomplete (`deviation`, `track`, `model`)
- no formal category split yet between editable / stats-only / empty-state

---

## Backend/API audit

### `app/src/subsidence/api/projects.py`

Good:

- create/open/close/save project
- recent projects
- overwrite support
- create/delete well
- import endpoints
- visual-config API
- export stubs

Weak points:

- mutating endpoints do not advertise save semantics explicitly
- destructive overwrite remains broad by design

### `app/src/subsidence/api/wells.py`

Good:

- empty wells load correctly
- well metadata patch exists
- strat-link schema is respected

Weak points:

- metadata patch is not yet routed through undo
- validation is minimal
- `x/y` in API still map onto `lon/lat` storage fields

### Strat-chart backend

Good:

- chart import exists
- chart activation exists
- delete-active-chart flow exists
- delete flow no longer breaks on FK constraints

Weak points:

- route naming still mixes legacy/transitional ideas
- built-in ICS protection must be frozen explicitly
- delete-all legacy semantics still need cleanup attention

---

## Contract drift audit

The current `docs/phase3-contract.md` is no longer a truthful implementation ledger.

Problems:

- many Step 2.5 checklist items are implemented in practice but still unchecked
- several already-shipped behaviors live under `partial` or `pending`
- the doc still mixes original roadmap intent with newer agreed UI behavior

This drift is now large enough that cleanup must treat the old contract as a roadmap reference,
not as a faithful progress tracker.

---

## Immediate cleanup priorities

1. Freeze save/autosave/dirty semantics in code
2. Implement true all-well inventory hydration
3. Refactor `App.tsx` into smaller modules
4. Normalize `Settings` into explicit editable / stats-only / empty-state categories
5. Harden built-in ICS and chart API semantics

---

## Definition of "audit complete"

The audit step is complete when:

- the repository has a factual written status snapshot
- the main save/autosave split is documented
- the primary bottlenecks are named explicitly
- the next cleanup steps can proceed without rediscovering baseline facts
