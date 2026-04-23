# SUBSIDENCE TODO

This file contains only active work that still needs to be done.

Rules:

- Every todo item must link to an active contract in `docs/contracts/`.
- Completed items are removed from this file.
- Completed contracts are moved to `docs/contracts/implemented/`.
- Historical or completed work must not remain here as checked-off clutter.

---

## Active Contracts

- [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md)
- [1D Well Model Architecture](docs/contracts/well_1d_model_architecture.md)
- [1D Well Model Summary](docs/contracts/well_1d_model_summary.md)

---

## Current Work

- [ ] Execute `M6 Safe refactoring pass` from [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md).
- [ ] Execute `M7 Resume UX and feature backlog` from [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md).

---

## M6 Safe Refactoring Plan

Goal:

- Reduce maintenance risk without changing behavior or API paths.
- Keep each refactor small enough to review and revert independently.
- Run tests after every extraction step.

Non-goals:

- Do not change project file format.
- Do not redesign UI.
- Do not change import semantics.
- Do not combine bugfixes with pure refactors unless a test exposes a real blocker.

Required checks after every backend step:

```bash
cd app
pytest tests
```

Required checks after every frontend step:

```bash
cd frontend
npm run test -- --run
npm run build
```

### M6.1 Backend API route/service seams

Target files:

- `app/src/subsidence/api/projects.py`
- New helper/service files only if they reduce route density clearly.

Steps:

- [ ] Extract project lifecycle helpers from `projects.py`: create/open/close/save/status/recent/path picker.
- [ ] Extract import route helpers from `projects.py`: LAS, logs CSV, tops, unconformities, deviation.
- [ ] Extract checkpoint/export/visual-config helpers from `projects.py`.
- [ ] Keep all existing route paths and response models unchanged.
- [ ] Run backend tests.
- [ ] Commit as `Refactor project API route helpers`.

Stop criteria:

- If any API test changes expected behavior, stop and inspect before continuing.
- If extraction requires changing model schemas, stop; that belongs to a separate contract.

### M6.2 Backend importer split

Target files:

- `app/src/subsidence/data/importers.py`
- Proposed new files:
- `app/src/subsidence/data/importers_common.py`
- `app/src/subsidence/data/import_las.py`
- `app/src/subsidence/data/import_logs_csv.py`
- `app/src/subsidence/data/import_tops.py`
- `app/src/subsidence/data/import_deviation.py`

Steps:

- [ ] Move CSV reading, numeric parsing, well resolution, metadata update, and curve payload writing into common helpers.
- [ ] Move LAS import code without changing public function signature `import_las_file`.
- [ ] Move logs CSV import code without changing public function signature `import_logs_csv`.
- [ ] Move tops/unconformities code without changing public function signatures.
- [ ] Move deviation code without changing public function signature `import_deviation_csv`.
- [ ] Preserve imports from `subsidence.data` so callers do not change.
- [ ] Run backend tests.
- [ ] Commit as `Split data importers by source type`.

Stop criteria:

- If circular imports appear, keep common helpers dependency-free and retry.
- If test fixtures need updating because behavior changed, stop; this refactor should not alter behavior.

### M6.3 Frontend Data Manager controller split

Target files:

- `frontend/src/components/layout/useDataManagerController.ts`
- Proposed new files:
- `frontend/src/components/layout/dataManagerSelection.ts`
- `frontend/src/components/layout/dataManagerVisibility.ts`
- `frontend/src/components/layout/dataManagerActions.ts`
- `frontend/src/components/layout/dataManagerContext.ts`

Steps:

- [ ] Extract pure object-selection helpers first.
- [ ] Extract visibility/toggle helpers for wells, curves, tops, and deviation.
- [ ] Extract context menu action helpers for duplicate/delete/rename.
- [ ] Keep hook public return shape unchanged for `DataManagerPane`.
- [ ] Run frontend tests and build.
- [ ] Commit as `Split Data Manager controller helpers`.

Stop criteria:

- If component tests need rewritten due to changed labels/DOM, stop; UI behavior should not change in M6.3.

### M6.4 Frontend Settings Inspector split

Target files:

- `frontend/src/components/layout/SettingsInspector.tsx`
- Proposed new files:
- `frontend/src/components/layout/settings/WellSettings.tsx`
- `frontend/src/components/layout/settings/LasSettings.tsx`
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/components/layout/settings/TopsSettings.tsx`
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/layout/settings/StratChartSettings.tsx`
- `frontend/src/components/layout/settings/ModelSettings.tsx`

Steps:

- [ ] Extract one settings panel at a time.
- [ ] Keep props explicit and typed.
- [ ] Keep existing labels and controls unchanged.
- [ ] Run frontend tests and build after every 1-2 panels.
- [ ] Commit as `Split Settings Inspector panels`.

Stop criteria:

- If settings behavior is unclear, document the ambiguity in `docs/modules/frontend-layout.md` and stop before changing behavior.

### M6.5 Stylesheet organization

Target files:

- `frontend/src/index.css`

Proposed strategy:

- Prefer section extraction only after component files are stable.
- If Vite import setup is simple, split into:
- `frontend/src/styles/app-layout.css`
- `frontend/src/styles/data-manager.css`
- `frontend/src/styles/log-view.css`
- `frontend/src/styles/subsidence-panel.css`
- `frontend/src/styles/dialogs.css`

Steps:

- [ ] Move CSS by existing selector groups, not by rewriting styles.
- [ ] Keep selector names unchanged.
- [ ] Import style files from `frontend/src/main.tsx` or a single `styles/index.css`.
- [ ] Run frontend tests and build.
- [ ] Manual visual smoke after restart: toolbar, Data Manager, log viewer, subsidence panel, dialogs.
- [ ] Commit as `Organize frontend styles`.

Stop criteria:

- If CSS split changes cascade behavior, revert that slice and leave `index.css` monolithic until visual tests exist.

### M6.6 Documentation update

Target files:

- `docs/codebase-map.md`
- `docs/modules/backend-api.md`
- `docs/modules/backend-data-layer.md`
- `docs/modules/frontend-layout.md`
- `docs/modules/frontend-state.md`
- `docs/modules/testing.md`
- `todo.md`

Steps:

- [ ] Update module ownership after refactor.
- [ ] Update "where to look" guidance.
- [ ] Remove M6 from `todo.md` only after all M6 commits are done and tests pass.
- [ ] Commit as `Update docs after M6 refactor`.

Final M6 acceptance:

- Backend tests pass: `30 passed` or higher.
- Frontend tests pass: `34 passed` or higher.
- Frontend build passes.
- `git status` is clean except intentionally ignored runtime files.
- Public API paths are unchanged.
- Existing project open/save/import workflows still work manually.

---

## Future Work

- [ ] Review and schedule [1D Well Model Architecture](docs/contracts/well_1d_model_architecture.md) and [1D Well Model Summary](docs/contracts/well_1d_model_summary.md).
