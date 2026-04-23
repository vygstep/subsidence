# Testing Module

This module tracks current test coverage and the required regression direction.

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

- Frontend: 25 passed.
- Backend: 21 passed.

---

## Current Coverage

Frontend:

- Formation drag optimistic update and debounce.
- Well switching.
- Depth clipping.

Backend:

- Formation CRUD at data layer.
- Formation depth persistence.
- Backstrip unit behavior.

---

## Required Regression Coverage

Missing high-priority workflows:

- Create/open/save/close/reopen project.
- Recent projects.
- LAS import.
- Logs CSV import with comma delimiter.
- Logs CSV import with tab delimiter.
- Tops import.
- Deviation import.
- Active target well import behavior.
- Delete well.
- Strat chart load/delete/current behavior.
- Built-in ICS chart immutability.
- Visual config save/load per well.
- Undo/redo through API.
- Checkpoint create/restore/delete.
- Data Manager selection and settings routing.
- Context menus.
- Track reorder/config persistence.
- Subsidence WebSocket recalculation.
- PNG/export behavior.

---

## Test Strategy

Preferred order:

1. Backend API integration tests for persistence and import workflows.
2. Frontend store tests for state hydration and visual config.
3. Frontend component tests for Data Manager and Settings Inspector.
4. Browser smoke tests later, after diagnostics/logging exists.

Rule:

- Add tests before refactoring large modules.
