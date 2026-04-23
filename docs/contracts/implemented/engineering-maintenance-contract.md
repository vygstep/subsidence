# Engineering Maintenance Contract

**Status:** Implemented  
**Created:** 2026-04-23  
**Completed:** 2026-04-23  
**Scope:** Maintainability audit, regression testing, process logging, and codebase documentation after Phase 5.

This contract is intentionally not a feature phase. Its goal is to make the existing application easier to debug, refactor, and extend without breaking the core well-log, stratigraphy, and subsidence workflows.

---

## 1. Current State

### 1.1 What is working

- The application has a complete FastAPI + React/Zustand architecture.
- Project lifecycle, well data import, strat charts, well viewer, settings inspector, subsidence panel, export, undo/redo, and checkpoints are implemented.
- Existing automated tests pass:
  - Frontend: `34 passed` via `npm run test -- --run`
  - Backend: `30 passed` via `pytest tests`
- Phase 5 is marked complete in `docs/contracts/implemented/phase5-contract.md`.

### 1.2 Main risk

The code is functional but entering a high-maintenance zone. Several files now combine too many responsibilities, the documentation is not fully aligned with the real implementation, and process-level logging is almost absent. Future UX and bugfix work will be slow unless we add stable seams, tests, and operational visibility first.

---

## 2. Audit Findings

### F1. Documentation truth is fragmented

Observed:

- `docs/contracts/implemented/app_compass.md` still contains early greenfield assumptions and implementation-contract text.
- `todo.md` must stay compact and aligned with active post-Phase 5 work.
- `todo.md` still points to Phase 3 cleanup work.
- Multiple phase and cleanup documents contain valuable details, but there is no single current code map.

Risk:

- A developer has to infer the real architecture from source code instead of docs.
- Future fixes may target the wrong module or duplicate previous work.

Required fix:

- Create and maintain a short current-state document.
- Add a codebase map with ownership boundaries.
- Keep phase contracts as historical records, not as the current navigation layer.

### F2. Frontend files are too large and mixed-responsibility

Largest frontend files:

- `frontend/src/index.css`: 1755 lines
- `frontend/src/components/layout/SettingsInspector.tsx`: 636 lines
- `frontend/src/components/layout/useDataManagerController.ts`: 609 lines
- `frontend/src/stores/wellDataStore.ts`: 538 lines
- `frontend/src/components/layout/ProjectToolbar.tsx`: 494 lines
- `frontend/src/stores/projectStore.ts`: 450 lines

Risk:

- Small UX changes can accidentally affect unrelated flows.
- It is hard to test a single behavior without pulling a large controller/store into the test.
- CSS changes are especially risky because the stylesheet is monolithic.

Required fix:

- Split by stable responsibilities, not by arbitrary line count.
- Extract pure helpers first, then component sections, then store slices only where needed.
- Do not rewrite renderers or stores wholesale.

### F3. Backend routers and importers are too dense

Largest backend files:

- `app/src/subsidence/data/importers.py`: 1003 lines
- `app/src/subsidence/api/projects.py`: 833 lines
- `app/src/subsidence/data/project_manager.py`: 577 lines
- `app/src/subsidence/data/undo.py`: 513 lines
- `app/src/subsidence/api/wells.py`: 470 lines

Risk:

- Import behavior, project filesystem behavior, API validation, and persistence are tightly coupled.
- Debugging import/save/open bugs requires reading several large files.
- Tests cover data-layer formation behavior but not full API import/reopen workflows.

Required fix:

- Add service-level seams around imports, project lifecycle, visual config, and diagnostics.
- Keep route handlers thin over time.
- Add API integration tests before moving logic.

### F4. Automated tests are green but incomplete

Existing coverage:

- Formation depth updates and CRUD at backend data layer.
- Backstrip unit calculations.
- Frontend formation drag, well switching, and depth clipping.

Missing critical workflows:

- Create/open/save/close/reopen project.
- Recent projects.
- LAS import and logs CSV import through API.
- Tab-delimited CSV logs.
- Tops import, strat chart linking, and active chart switching.
- Deviation import.
- Delete well and delete strat chart.
- Visual config save/load per well.
- Undo/redo across real API operations.
- Checkpoint create/restore/delete.
- Subsidence WebSocket recalculation.
- PNG/export behavior.
- Data Manager selection/settings/context menu behavior.

Required fix:

- Build a regression matrix around user workflows, not implementation files.
- Add tests in layers: pure unit tests, backend API integration tests, frontend store/component tests, and one later browser smoke layer.

### F5. Process logging is insufficient

Observed:

- No structured application logging was found in the backend source.
- Frontend has no diagnostic event stream for import/open/save/recalculate failures.
- User-facing errors are not enough for maintenance because they omit operation context.

Risk:

- Bugs require reading code and reproducing manually.
- Import/save/reopen failures cannot be diagnosed from logs.
- Slow UI operations have no timing data.

Required fix:

- Add backend structured logs with operation IDs.
- Add frontend process events for user-triggered workflows.
- Add a diagnostics export that captures recent frontend events, backend log tail, project path, active well, and app version.

### F6. Dirty project data can mask real source changes

Observed:

- `projects/test.subsidence` contains modified, deleted, and untracked generated data.
- `sample_data/well_log.csv` is untracked.
- Some extra docs are untracked.

Risk:

- Commits can accidentally include generated project artifacts.
- Test data changes can make real source diffs harder to review.

Required fix:

- Decide which sample data is intentionally tracked.
- Ignore generated project runtime artifacts unless they are explicit fixtures.
- Keep source changes and runtime project changes separate.

---

## 3. Execution Plan

Each checkpoint should be small enough to review and commit independently.

### M0. Stabilize project truth

Deliverables:

- Update `todo.md` to point to this maintenance contract.
- Update or replace stale current-state documentation.
- Clarify which phase documents are historical and which docs are current navigation.

Acceptance:

- A new developer can find the current architecture, test commands, and next work from `todo.md`.

### M1. Codebase map and ownership boundaries

Deliverables:

- `docs/documentation-index.md`, `docs/architecture.md`, `docs/codebase-map.md`, and `docs/modules/*` with backend modules, frontend modules, data flow, and "where to look" guidance.
- List of modules that must not be casually changed without tests.

Acceptance:

- Common bug reports can be mapped to likely files without reading the entire codebase.

### M2. Regression test matrix

Deliverables:

- A workflow-based test matrix covering project lifecycle, imports, Data Manager, strat charts, visual config, undo/redo, checkpoints, subsidence, and export.
- Mark each test as existing, missing, or deferred.

Acceptance:

- Every critical user workflow has at least one planned automated test.
- Existing tests are documented as part of the matrix.

### M3. Backend process logging

Deliverables:

- Central backend logger setup.
- Request ID middleware.
- Operation logs for:
  - create/open/save/close project
  - import LAS/logs CSV/tops/deviation
  - create/delete well
  - load/update/delete strat chart
  - patch visual config
  - undo/redo/checkpoint
  - subsidence recalculation
- Logs include operation name, project path, well ID/name when available, duration, result, and exception details.

Acceptance:

- A failed import or save can be diagnosed from logs without reading source code first.

### M4. Frontend process logging and diagnostics

Deliverables:

- Small frontend event logger with a bounded in-memory ring buffer.
- Events for the same user workflows as backend logging.
- Diagnostic export/copy action for bug reports.

Acceptance:

- A user can reproduce a bug, export diagnostics, and the logs identify the last failed operation.

### M5. Critical workflow tests

Deliverables:

- Backend API integration tests for project lifecycle, imports, visual config, undo/redo, checkpoint, and strat chart workflows.
- Frontend tests for Data Manager selection/settings, toolbar menu behavior, target active well behavior, and visual config hydration.
- Keep test fixtures small and deterministic.

Acceptance:

- Tests run locally from documented commands.
- The first regression suite catches save/reopen/import breakage.

### M6. Safe refactoring pass

Deliverables:

- Extract pure helpers from large modules first.
- Split `SettingsInspector.tsx` by inspector type.
- Split `useDataManagerController.ts` into selection, commands, context menu, and object actions.
- Split `index.css` into domain sections or component styles after visual regression checks.
- Split backend importers into LAS, logs CSV, tops/unconformities, deviation, and shared well resolution helpers.
- Split `projects.py` into route groups or service functions while preserving API paths.

Acceptance:

- No behavior changes without tests.
- Each extraction is covered by existing or newly added tests.
- Git diffs are mostly moves plus small seam changes.

### M7. UX bug/improvement work resumes

Deliverables:

- Continue functional/UX backlog only after M0-M5 create a reliable safety net.

Acceptance:

- New UX changes are implemented against tested flows and produce useful logs when they fail.

---

## 4. Regression Matrix

| Workflow | Existing coverage | Required coverage |
|---|---|---|
| Backend health | Partial | API smoke test |
| Create project | Missing | API integration |
| Open project | Missing | API integration + frontend store |
| Save project | Missing | API integration with reopen assertion |
| Close project | Missing | API integration |
| Recent projects | Missing | API integration |
| Create well | Missing | API integration + frontend dialog/store |
| Delete well | Missing | API integration + Data Manager state |
| Import LAS | Missing | API integration using sample LAS |
| Import logs CSV comma | Missing | API integration |
| Import logs CSV tab | Missing | API integration |
| Import tops | Missing | API integration + link behavior |
| Import deviation | Missing | API integration |
| Active target well import | Partial/manual | Frontend + backend API behavior |
| Well switching | Existing frontend | Add backend/API reopen coverage |
| Formation CRUD | Existing backend data layer | Add API endpoint coverage |
| Formation drag debounce | Existing frontend | Keep |
| Strat chart load/delete/current | Missing | API integration + frontend state |
| Built-in ICS chart immutability | Missing | Data-layer/API test |
| Visual config save/load | Missing | API integration + frontend hydration |
| Undo/redo | Missing | API integration |
| Checkpoints | Missing | API integration |
| Data Manager selection/settings | Missing | Frontend component/store |
| Context menus | Missing | Frontend component |
| Track reorder/config | Missing | Frontend store/component |
| Subsidence recalculation | Partial backstrip unit | Backend WebSocket/integration |
| PNG/export | Missing | Frontend/backend smoke |

---

## 5. Logging Contract

### 5.1 Backend event shape

Backend logs should be structured and grep-friendly. JSON lines are preferred.

Required fields:

- `timestamp`
- `level`
- `request_id`
- `operation`
- `phase`: `start`, `success`, `failure`
- `duration_ms` on completion
- `project_path` when available
- `well_id` and `well_name` when available
- `input_path` for imports when safe
- `result_summary`
- `error_type` and `error_message` on failure

Example operations:

- `project.create`
- `project.open`
- `project.save`
- `project.close`
- `well.create`
- `well.delete`
- `import.las`
- `import.logs_csv`
- `import.tops`
- `import.deviation`
- `strat_chart.load`
- `strat_chart.delete`
- `visual_config.patch`
- `undo.run`
- `redo.run`
- `checkpoint.create`
- `checkpoint.restore`
- `subsidence.recalculate`

### 5.2 Frontend event shape

Frontend diagnostics should use a bounded in-memory event list.

Required fields:

- `timestamp`
- `level`
- `operation`
- `phase`
- `durationMs`
- `projectPath`
- `activeWellId`
- `selectedObject`
- `message`
- `error`

The frontend logger must not replace user-facing errors. It is a diagnostic layer for maintenance.

---

## 6. Refactoring Rules

- Do not refactor and change behavior in the same commit unless the behavior change is the explicit goal.
- Add or identify tests before extracting logic from large files.
- Prefer pure helper extraction before moving React components or Zustand state.
- Preserve existing API paths.
- Preserve project file format unless a migration is explicitly documented.
- Keep generated project artifacts out of normal source commits.
- Every extracted module must have a short docstring or top-level comment explaining its boundary if the boundary is not obvious.

---

## 7. Immediate Next Steps

1. Update the current-state docs so they match Phase 5 reality.
2. Add the codebase map.
3. Add the regression matrix as executable test work items.
4. Implement backend logging first because it improves every later bugfix.
5. Add project lifecycle and import API tests before refactoring backend import/project modules.
6. Add frontend diagnostics and Data Manager tests before refactoring large layout/controller files.
