# Phase 3 Verification

This file records the verification outcomes after the cleanup pass.

It is not a planning document. It exists to show which checks were actually run,
which bugs were fixed during verification, and which items still require manual UI
coverage.

---

## Environment checks

### Backend package/runtime

Verified:

- `app/pyproject.toml` no longer contains a UTF-8 BOM
- backend package metadata no longer references a README outside `app/`
- `uv run python -c "import fastapi; print(fastapi.__version__)"`
  succeeds from `app/`

Fixes applied during verification:

- normalized `app/pyproject.toml` encoding
- switched backend package readme to local `app/README.md`

### Static validation

Verified:

- `python -m py_compile app/src/subsidence/api/projects.py app/src/subsidence/api/wells.py app/src/subsidence/api/formations.py app/src/subsidence/api/strat_chart.py app/src/subsidence/data/undo.py app/src/subsidence/data/__init__.py`
- `python -m py_compile app/src/subsidence/api/strat_chart.py app/src/subsidence/data/dict_seeder.py`
- `npm run build` in `frontend/`

All of the above passed at cleanup time.

---

## Runtime smoke checks

Runtime smoke was executed with:

- `uv run --extra dev python -`
- FastAPI `TestClient`

### Verified scenarios

1. `Create project` + `Open project`
- project bundle opens successfully
- working session starts correctly

2. Built-in ICS availability
- `GET /api/strat-charts` returns a built-in chart
- built-in chart is active on fresh project open
- built-in chart source resolves to `sample_data/ics_chart2023.csv`

3. `Create well`
- `POST /api/projects/wells` succeeds
- empty well is readable immediately

4. Well metadata edit undo
- `PATCH /api/wells/{well_id}` updates metadata
- `POST /api/projects/undo` restores previous metadata

5. Formation create with active-chart enrichment
- `POST /api/wells/{well_id}/formations` succeeds
- created `Holocene` top auto-links to the active built-in ICS chart

6. Formation unlink + undo
- `PUT /api/wells/{well_id}/formations/{formation_id}/strat-link` with `strat_unit_id = null` removes the link
- `POST /api/projects/undo` restores the link

7. Project close
- `POST /api/projects/close` succeeds
- temporary test bundle can be cleaned without stale runtime state, as long as close happens before temp cleanup

---

## Bugs found and fixed during verification

### Backend packaging blockers

Fixed:

- UTF-8 BOM in `app/pyproject.toml` broke `uv` / `tomllib`
- backend package `readme = "../README.md"` broke editable build under `setuptools`

### Save/undo consistency

Fixed:

- well metadata edits are now routed through undoable backend commands
- top link / unlink now participates in backend undo/dirty flow
- top deletion now autosaves consistently
- well deletion now autosaves consistently
- chart activation no longer autosaves immediately; it now remains dirty until explicit save

### Built-in strat chart safety

Fixed:

- built-in ICS chart is now treated as protected
- built-in chart cannot be deleted from backend API
- built-in chart cannot be deleted from toolbar or chart list UI
- built-in chart source is normalized to `sample_data/ics_chart2023.csv`

---

## Remaining manual UI verification

The following still require manual browser coverage:

- two-row toolbar flows across `Project / StratChart / Wells / Tops`
- `Data Manager` drag splitters and collapse behavior
- `Settings` inspector editing flows from real UI events
- chart switch behavior with existing imported user charts
- explicit `Save project` / reopen behavior for dirty-only viewer changes
- protected built-in chart behavior in mixed built-in + imported chart projects

---

## Verification status

### Passed

- backend static validation
- frontend production build
- backend runtime package startup
- project / well / top / chart smoke scenarios listed above

### Partial

- full browser-level UI verification matrix
- persistence verification for all per-well viewer composition settings

### Conclusion

The cleanup pass materially stabilized Phase 3.

What is now true:

- save/autosave semantics are much closer to the agreed contract
- `Data Manager` is project-wide
- `App.tsx` is reduced compared with the pre-cleanup state
- built-in ICS is protected and normalized
- backend runtime packaging is no longer broken

What still remains before calling Phase 3 fully hardened:

- full manual UI verification
- final persistence boundary for all per-well viewer composition settings
