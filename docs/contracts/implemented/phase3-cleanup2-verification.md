# Phase 3 Cleanup 2 Verification

This file records the verification snapshot for the second Phase 3 stabilization pass.

It complements:

- `docs/phase3-verification.md`
- `docs/contracts/implemented/phase3-cleanup-contract.md`
- `docs/contracts/implemented/phase3-cleanup2-contract.md`

It is not a planning document.

---

## Automated checks completed

### 1. Documentation truthfulness / encoding

Verified:

- `docs/contracts/implemented/phase3-contract.md` no longer contains mojibake
- `docs/contracts/implemented/phase3-contract.md` now explicitly points to cleanup and verification documents
- top-level progress wording no longer pretends to be the only truthful Phase 3 ledger

### 2. Persistence boundary

Verified:

- project visual config remains project-scoped
- well visual config now hydrates per well
- viewer visual changes remain live in frontend state
- viewer visual changes mark the project dirty without immediate autosave
- `Save project` now commits:
  - project visual config
  - well-scoped visual configs
  - canonical project save
- no-op visual-config patches no longer create backend undo noise

Validation run:

- `python -m py_compile app/src/subsidence/api/projects.py`
- `npm run build` in `frontend/`

### 3. Unified `Load logs`

Verified:

- `Load logs` dialog now supports both `LAS` and `CSV`
- new backend route exists:
  - `POST /api/projects/import-logs-csv`
- CSV logs merge into the canonical per-well parquet storage
- imported CSV curves do not auto-mount into viewer tracks
- `Data Manager` / `Settings` wording now says `Logs` instead of `LAS` for the group node

Validation run:

- `python -m py_compile app/src/subsidence/api/projects.py app/src/subsidence/data/importers.py app/src/subsidence/data/__init__.py`
- `npm run build` in `frontend/`
- FastAPI `TestClient` smoke:
  - create/open project
  - import CSV logs
  - read well payload
  - confirm imported curve mnemonics

### 4. `DataManagerPane` split

Verified:

- `DataManagerPane.tsx` no longer contains the entire feature controller + both zone renderers inline
- logic extracted to:
  - `frontend/src/components/layout/useDataManagerController.ts`
- top-zone rendering extracted to:
  - `frontend/src/components/layout/DataManagerTopPane.tsx`
- bottom-zone shell extracted to:
  - `frontend/src/components/layout/SettingsPaneShell.tsx`

Validation run:

- `npm run build` in `frontend/`

### 5. Metadata semantics cleanup

Verified:

- well metadata UI now says:
  - `Project X`
  - `Project Y`
- well inventory summary now says:
  - `Project X / Y`
- backend well payloads now expose:
  - `coordinate_semantics = "project_xy"`
- backend create/patch validation now rejects invalid values for:
  - `Project X`
  - `Project Y`
  - `KB`
  - `GL`
  - `TD`
  - empty `CRS`

Validation run:

- `python -m py_compile app/src/subsidence/api/wells.py app/src/subsidence/api/projects.py`
- `npm run build` in `frontend/`

### 6. Dirty/save smoke for visual config

Verified with FastAPI `TestClient`:

- patch well-scoped visual config
- project status becomes dirty
- `Save project` clears dirty state again
- project can close cleanly after save

---

## Object-type coverage matrix

Current status by object type:

| Object type | Selectable | Visualizable | Editable in Settings | Current mode |
|---|---|---:|---:|---|
| `well` | yes | indirect | yes | editable |
| `las-group` / `logs-group` | yes | group-toggle | partial | stats + browser |
| `curve` | yes | yes | yes | editable |
| `tops-group` | yes | group-toggle | partial | stats + browser |
| `top-pick` | yes | yes | yes | editable |
| `strat-chart` | yes | yes | partial | statistics |
| `deviation` | partial | yes | no | not yet implemented as typed inspector |
| `track` | indirect | yes | partial | viewer-side only |
| `model` | no | no | no | placeholder |

Notes:

- `las-group` still uses the historical selected-object type name internally, but the visible UI label is now `Logs`.
- `deviation` still lacks a dedicated typed inspector block.
- `track` lifecycle/settings are still not normalized as a first-class inspector object.

---

## Remaining manual browser verification

The following still require manual browser coverage:

1. `Load logs` with a real LAS file
2. `Load logs` with a real CSV log file
3. reopen project after unsaved viewer changes and confirm dirty-only behavior
4. save project after viewer changes and confirm persistence after reopen
5. multi-well switching with preserved per-well viewer composition
6. `Data Manager` splitters and collapse behavior after refactor
7. invalid numeric well edits from Settings
8. chart switch + imported chart delete fallback behavior

---

## Known non-blocking warning

`npm run build` still emits:

- `INEFFECTIVE_DYNAMIC_IMPORT` for `projectStore.ts`

This is currently non-blocking and does not fail the production build.

---

## Conclusion

Cleanup 2 now has automated coverage for:

- documentation truthfulness
- persistence boundary implementation
- unified log import path
- `DataManagerPane` architectural split
- explicit `Project X / Project Y` semantics and validation

What remains before calling the whole pass fully closed:

- manual browser verification from the matrix above
- dedicated inspector coverage for `deviation`
- fuller first-class handling for `track` as an inspected object
