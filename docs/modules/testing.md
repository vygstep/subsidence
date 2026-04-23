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

- Frontend: 28 passed.
- Backend: 27 passed.

---

## Current Coverage

Frontend:

- Active target well preselection in import dialogs.
- Formation drag optimistic update and debounce.
- Well switching.
- Depth clipping.

Backend:

- Project create/open/save/close/reopen and recent projects through API.
- Logs CSV comma/tab import through API.
- Tops, deviation, and strat chart API workflows.
- Visual config project/well scope persistence.
- Undo/redo, delete well, and checkpoint create/restore/delete through API.
- Formation CRUD at data layer.
- Formation depth persistence.
- Backstrip unit behavior.

---

## Required Regression Coverage

Missing high-priority workflows:

- LAS import.
- Built-in ICS chart immutability.
- Data Manager selection and settings routing.
- Context menus.
- Track reorder/config persistence.
- Subsidence WebSocket recalculation.
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
