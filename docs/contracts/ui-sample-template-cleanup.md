# UI Sample Defaults and Template Cleanup

Branch: `chore/ui-sample-template-cleanup`

## Status

`in_progress`

## Scope

Small cleanup pass for import fallback naming, Data Manager template counters,
legacy sample data, and public attribution.

## Product Rules

- Import fallback well naming must be centralized.
- `DEFAULT_WELL_NAME` in `app/src/subsidence/data/importers/common.py` is the
  single source of truth for the fallback well name.
- The fallback well name remains `well-1`.
- Importers must use the centralized fallback only when no target well is
  supplied and the source file does not provide a well name.
- Do not hardcode `well-1` separately in LAS, logs CSV, tops, or deviation
  importers.
- If a project already has an active well, import dialogs must continue to
  target the active well by default.
- Manual Create Well UI should suggest `well-1`, not `Pleshet 01`.
- The Templates tab must not show numeric counters on section headers or object
  rows.
- `built-in` and `user` labels are status labels, not counters, and may stay.
- `app/data` is legacy unless runtime, tests, or active docs prove otherwise.
- Public attribution should be visible in README: `Created by Stepan Vygovskiy`.

## Implementation Plan

### S1: Import fallback well naming

- Verify all importers use `DEFAULT_WELL_NAME` from `importers/common.py`.
- Keep the fallback value as `well-1`.
- Avoid new per-importer fallback constants.
- Add or update tests proving imports do not fail when no target well is supplied
  and the file has no well name.
- Preserve active-well targeting when `activeWellId` exists.

Status: done. Verified by `pytest tests/integration/test_project_api_workflows.py -k "fallback_well or las_import_auto_creates_well"`.

### S2: Create Well placeholder

- Change the manual Create Well dialog placeholder from `Pleshet 01` to
  `well-1`.
- Keep this as UI guidance only; users can still enter any well name.

Status: done.

### S3: Legacy `app/data` cleanup

- Verify active runtime, tests, and active docs do not depend on `app/data`.
- Remove the tracked `app/data` folder if it is only legacy sample data.
- Keep historical implemented contracts unchanged unless they incorrectly appear
  in active navigation.

Status: done. Active references outside this contract were not found.

### S4: Templates tab counters

- Remove section count badges.
- Remove numeric row metadata counters from template rows:
  - mnemonic `entry_count`;
  - measurement unit `unit_count`;
  - pattern palette `entry_count`;
  - lithology set `entry_count`.
- Keep `built-in` and `user` labels.

Status: done.

### S5: Attribution

- Add `Created by Stepan Vygovskiy` to README near the project intro.

Status: done.

### S6: Verification

- Run targeted backend import tests.
- Run frontend tests covering templates/import UI.
- Report any intentionally skipped tests.

Status: pending.
