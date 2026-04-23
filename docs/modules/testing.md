# Testing Module

This module tracks current test coverage and the required regression direction.

Detailed workflow-level planning lives in `docs/regression-test-matrix.md`.

---

## Current Commands

Frontend:

```bash
cd frontend
npm run test -- --run
```

Backend:

```bash
cd app
pytest tests
```

Baseline from 2026-04-23:

- Frontend: 34 passed.
- Backend: 30 passed.

---

## Current Coverage

Frontend:

- Active target well preselection in import dialogs.
- Data Manager all-wells tree, group expansion, and well/curve/top selection callbacks.
- Formation drag optimistic update and debounce.
- Project menu actions and undo/redo wiring.
- Project visual config hydration into view and curve stores.
- Well switching.
- Depth clipping.

Backend:

- Project create/open/save/close/reopen and recent projects through API.
- LAS import auto-create and save/reopen through API.
- Logs CSV comma/tab import through API.
- Tops, deviation, and strat chart API workflows.
- Built-in ICS chart delete protection.
- Subsidence REST calculation, WebSocket recalculation, and stored result loading.
- Visual config project/well scope persistence.
- Undo/redo, delete well, and checkpoint create/restore/delete through API.
- Formation CRUD at data layer.
- Formation depth persistence.
- Backstrip unit behavior.

---

## Required Regression Coverage

Missing high-priority workflows:

- LAS import into explicit existing well.
- Full Data Manager settings inspector routing for every object type.
- Context menus.
- Track reorder/config persistence.
- PNG/export behavior.

See `docs/regression-test-matrix.md` for planned test IDs, files, layers, and execution order.

---

## Test Strategy

Preferred order:

1. Backend API integration tests for persistence and import workflows.
2. Frontend store tests for state hydration and visual config.
3. Frontend component tests for Data Manager and Settings Inspector.
4. Browser smoke tests later, after diagnostics/logging exists.

Rule:

- Add tests before refactoring large modules.
