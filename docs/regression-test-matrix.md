# Regression Test Matrix

**Status:** Active test planning document  
**Created:** 2026-04-23  
**Scope:** Post-Phase 5 regression coverage for maintenance, logging, and safe refactoring.

This matrix turns critical user workflows into executable test work items. It is not a test implementation report; it is the source list for what must be automated before risky refactors.

---

## 1. Current Baseline

Current automated tests:

- Backend: `21 passed` via `cd app && pytest tests`
- Frontend: `25 passed` via `cd frontend && npm run test -- --run`

Existing backend tests:

- `app/tests/unit/test_backstrip.py`
- `app/tests/integration/test_formation_crud.py`
- `app/tests/integration/test_formation_depth_persistence.py`

Existing frontend tests:

- `frontend/src/__tests__/unit/depthClipping.test.ts`
- `frontend/src/__tests__/integration/FormationDepthDrag.integration.test.ts`
- `frontend/src/__tests__/integration/WellSwitching.integration.test.ts`

---

## 2. Test Layers

Use these layers consistently:

| Layer | Purpose | Tools |
|---|---|---|
| Backend unit | Pure scientific/data helpers | `pytest` |
| Backend API integration | FastAPI routes, SQLite project state, import/save/reopen behavior | `pytest`, `httpx`/FastAPI test client |
| Frontend unit | Pure TS helpers, state coercion, render helpers | `vitest` |
| Frontend store/component | Zustand stores, dialogs, Data Manager, settings routing | `vitest`, React Testing Library |
| Browser smoke | Full app behavior that cannot be validated well in jsdom | deferred until logging exists |

Rule:

- Prefer backend API integration tests before refactoring backend routes/importers.
- Prefer frontend store/component tests before refactoring Data Manager, Settings Inspector, or stores.

---

## 3. Fixture Policy

Available sample files:

- `sample_data/sample_well_log.las`
- `sample_data/tops.csv`
- `sample_data/deviation.csv`
- `sample_data/unconformities.csv`
- `sample_data/ics_chart2023.csv`
- `sample_data/ics_chart2023_units.csv`
- `sample_data/ics_chart2023_ranks.csv`
- `sample_data/well_log.csv` exists locally but is currently untracked.

Fixture rules:

- Do not depend on large untracked local files for committed tests.
- For CSV delimiter tests, create tiny temporary CSV files inside the test.
- For LAS import tests, either use the existing tracked LAS if acceptable for runtime, or add a tiny dedicated LAS fixture later.
- Project-bundle tests should use temporary directories, not `projects/test.subsidence`.

---

## 4. Priority Groups

### P0: Must Exist Before Backend Refactor

These protect `projects.py`, `importers.py`, `project_manager.py`, `engine.py`, and project format behavior.

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| BE-P0-001 | Health endpoint returns OK | missing | `app/tests/api/test_health.py` | Backend API | planned |
| BE-P0-002 | Create project in temp directory | missing | `app/tests/api/test_project_lifecycle.py` | Backend API | planned |
| BE-P0-003 | Open existing project | missing | `app/tests/api/test_project_lifecycle.py` | Backend API | planned |
| BE-P0-004 | Save project and reopen without data loss | missing | `app/tests/api/test_project_lifecycle.py` | Backend API | planned |
| BE-P0-005 | Close project clears open state | missing | `app/tests/api/test_project_lifecycle.py` | Backend API | planned |
| BE-P0-006 | Recent projects updated after create/open | missing | `app/tests/api/test_project_lifecycle.py` | Backend API | planned |
| BE-P0-007 | Create well through API | missing | `app/tests/api/test_well_lifecycle.py` | Backend API | planned |
| BE-P0-008 | Delete well removes related project data | missing | `app/tests/api/test_well_lifecycle.py` | Backend API | planned |
| BE-P0-009 | Visual config save/load project scope | missing | `app/tests/api/test_visual_config.py` | Backend API | planned |
| BE-P0-010 | Visual config save/load well scope | missing | `app/tests/api/test_visual_config.py` | Backend API | planned |
| BE-P0-011 | Checkpoint create/list/restore/delete | missing | `app/tests/api/test_checkpoints.py` | Backend API | planned |
| BE-P0-012 | Undo/redo API changes project state | missing | `app/tests/api/test_undo_redo.py` | Backend API | planned |

### P0: Must Exist Before Importer Refactor

These protect `data/importers.py`, `data/loaders.py`, curve payload paths, well auto-resolution, and save/reopen after import.

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| BE-P0-101 | Import LAS into explicit existing well | missing | `app/tests/api/test_import_las.py` | Backend API | planned |
| BE-P0-102 | Import LAS auto-creates well when no target exists | missing | `app/tests/api/test_import_las.py` | Backend API | planned |
| BE-P0-103 | Import logs CSV comma delimiter | missing | `app/tests/api/test_import_logs_csv.py` | Backend API | planned |
| BE-P0-104 | Import logs CSV tab delimiter | missing | `app/tests/api/test_import_logs_csv.py` | Backend API | planned |
| BE-P0-105 | Logs CSV without well name imports into active/target well | missing | `app/tests/api/test_import_logs_csv.py` | Backend API | planned |
| BE-P0-106 | Duplicate well name is reused unless explicit create-new policy | missing | `app/tests/api/test_import_target_well.py` | Backend API | planned |
| BE-P0-107 | Import tops into explicit well | missing | `app/tests/api/test_import_tops.py` | Backend API | planned |
| BE-P0-108 | Import tops links/colors against active strat chart | missing | `app/tests/api/test_import_tops.py` | Backend API | planned |
| BE-P0-109 | Import deviation into explicit well | missing | `app/tests/api/test_import_deviation.py` | Backend API | planned |
| BE-P0-110 | Save/reopen after LAS/logs/tops/deviation imports | missing | `app/tests/api/test_import_reopen.py` | Backend API | planned |

### P1: Stratigraphy and Formations

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| BE-P1-001 | Formation CRUD through API endpoints | backend data-layer only | `app/tests/api/test_formations_api.py` | Backend API | planned |
| BE-P1-002 | Formation depth update through API | backend data-layer only | `app/tests/api/test_formations_api.py` | Backend API | planned |
| BE-P1-003 | Formation strat-link create/update through API | missing | `app/tests/api/test_formation_strat_link.py` | Backend API | planned |
| BE-P1-004 | Load strat chart CSV | missing | `app/tests/api/test_strat_charts.py` | Backend API | planned |
| BE-P1-005 | Activate strat chart changes active chart only | missing | `app/tests/api/test_strat_charts.py` | Backend API | planned |
| BE-P1-006 | Delete current non-built-in strat chart only | missing | `app/tests/api/test_strat_charts.py` | Backend API | planned |
| BE-P1-007 | Built-in ICS chart cannot be deleted | missing | `app/tests/api/test_strat_charts.py` | Backend API | planned |

### P1: Frontend Project and Data Manager

These protect `projectStore.ts`, `workspaceStore.ts`, `wellDataStore.ts`, `DataManagerPane.tsx`, `WellDataPanel.tsx`, and `useDataManagerController.ts`.

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| FE-P1-001 | Project open hydrates visual config before well view state | missing | `frontend/src/__tests__/integration/ProjectOpen.integration.test.ts` | Frontend store | planned |
| FE-P1-002 | Per-well visual config persists track order and curve config | missing | `frontend/src/__tests__/integration/VisualConfig.integration.test.ts` | Frontend store | planned |
| FE-P1-003 | Active target well preselected in import dialogs | missing | `frontend/src/__tests__/integration/ImportDialogTargetWell.integration.test.tsx` | Frontend component | planned |
| FE-P1-004 | Data Manager shows all wells, not only active well | manual only | `frontend/src/__tests__/integration/DataManagerTree.integration.test.tsx` | Frontend component | planned |
| FE-P1-005 | Data Manager selection routes to correct settings object | missing | `frontend/src/__tests__/integration/SettingsRouting.integration.test.tsx` | Frontend component | planned |
| FE-P1-006 | Context menu duplicate/delete/rename appears for supported objects | missing | `frontend/src/__tests__/integration/DataManagerContextMenu.integration.test.tsx` | Frontend component | planned |
| FE-P1-007 | LAS folder checkbox toggles all curves | missing | `frontend/src/__tests__/integration/DataManagerVisibility.integration.test.tsx` | Frontend component | planned |
| FE-P1-008 | TOPS tri-state checkbox empty/partial/all behavior | manual only | `frontend/src/__tests__/integration/DataManagerVisibility.integration.test.tsx` | Frontend component | planned |

### P1: Viewer and Settings

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| FE-P1-101 | Depth clipping remains correct | existing | `frontend/src/__tests__/unit/depthClipping.test.ts` | Frontend unit | keep |
| FE-P1-102 | Formation drag debounce and optimistic update | existing | `frontend/src/__tests__/integration/FormationDepthDrag.integration.test.ts` | Frontend store | keep |
| FE-P1-103 | Well switching clears stale selections and data | existing | `frontend/src/__tests__/integration/WellSwitching.integration.test.ts` | Frontend store | keep |
| FE-P1-104 | Track reorder persists in workspace state | missing | `frontend/src/__tests__/integration/TrackReorder.integration.test.tsx` | Frontend component/store | planned |
| FE-P1-105 | MD and Formations static tracks can be selected and reordered rules are respected | missing | `frontend/src/__tests__/integration/TrackSelection.integration.test.tsx` | Frontend component | planned |
| FE-P1-106 | Curve settings update track curve config | missing | `frontend/src/__tests__/integration/CurveSettings.integration.test.tsx` | Frontend component/store | planned |
| FE-P1-107 | Well metadata settings PATCH and reload | missing | `frontend/src/__tests__/integration/WellSettings.integration.test.tsx` | Frontend component/store | planned |

### P2: Subsidence and Export

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| BE-P2-001 | Backstrip pure calculation | existing | `app/tests/unit/test_backstrip.py` | Backend unit | keep |
| BE-P2-002 | Subsidence REST calculation stores result | missing | `app/tests/api/test_subsidence.py` | Backend API | planned |
| BE-P2-003 | Stored subsidence results load for multi-well panel | missing | `app/tests/api/test_subsidence.py` | Backend API | planned |
| BE-P2-004 | WebSocket recalculation returns success/error payloads | missing | `app/tests/api/test_subsidence_ws.py` | Backend API/WS | planned |
| FE-P2-001 | `computedStore` sends recalculation and handles timeout/error | missing | `frontend/src/__tests__/integration/SubsidenceRecalculation.integration.test.ts` | Frontend store | planned |
| FE-P2-002 | Export PNG calls download path with non-empty canvas target | missing | `frontend/src/__tests__/unit/exportPng.test.ts` | Frontend unit | planned |

### P2: Dictionaries, Presets, and Utilities

| ID | Workflow | Current coverage | Planned test file | Layer | Status |
|---|---|---|---|---|---|
| BE-P2-101 | Curve mnemonic resolver returns expected family/range | missing | `app/tests/unit/test_dict_resolver.py` | Backend unit | planned |
| BE-P2-102 | Lithology defaults seed compaction params | missing | `app/tests/unit/test_dict_seeder.py` | Backend unit | planned |
| BE-P2-103 | Unit conversion handles depth/gamma/slowness cases | missing | `app/tests/unit/test_unit_conversion.py` | Backend unit | planned |
| FE-P2-101 | `curvePresets.ts` returns expected visual defaults | missing | `frontend/src/__tests__/unit/curvePresets.test.ts` | Frontend unit | planned |
| FE-P2-102 | `pathMemory.ts` stores project/import roots correctly | missing | `frontend/src/__tests__/unit/pathMemory.test.ts` | Frontend unit | planned |

---

## 5. Execution Order

Recommended implementation order:

1. Backend project lifecycle tests: `BE-P0-001` through `BE-P0-012`.
2. Backend import tests: `BE-P0-101` through `BE-P0-110`.
3. Backend strat chart/formations API tests: `BE-P1-001` through `BE-P1-007`.
4. Frontend visual config and project hydration tests: `FE-P1-001` through `FE-P1-003`.
5. Data Manager and Settings tests: `FE-P1-004` through `FE-P1-008`, then `FE-P1-106` and `FE-P1-107`.
6. Viewer track and settings tests: `FE-P1-104` through `FE-P1-105`.
7. Subsidence and export tests.
8. Dictionary and utility tests.

Rationale:

- Project lifecycle and imports protect the riskiest backend refactors.
- Visual config and Data Manager tests protect the riskiest frontend refactors.
- Subsidence/export tests are important but should benefit from M3/M4 logging first.

---

## 6. Todo Policy

After this matrix is committed:

- `todo.md` should point to M3 unless test implementation is intentionally pulled forward.
- M5 should use this matrix as the execution list.
- When a planned test is implemented, update its row from `planned` to `implemented`.

