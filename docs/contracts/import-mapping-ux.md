# Import Mapping UX And Log/Strat Import Review

Status: Draft
Branch: feature/import-mapping-ux

## Goal

Make import column mapping faster and less error-prone across the tabular import wizards, and clean up the current confusing behavior in CSV log and StratChart imports.

## Current Problems

### 1. Mapping Reassignment

The mapping row prevents assigning a field to a new CSV column if that field is already assigned elsewhere. The user has to manually set the old column to `-` first, then assign the field to the new column.

Status: Implemented.

### 2. CSV Log Mapping Labels

For CSV log import, the mapping row only exposes `Well name` and `Depth column`. All real log columns remain visually shown as `-`, even though they are imported as curves. This makes it unclear which curve mnemonics will be created.

The depth mapping should read as the real depth mnemonic, normally `MD`, instead of the generic `Depth column`. The second row that controls log curve type can still show the depth role/reference.

Status: Implemented.

### 3. CSV Curve Type Detection

CSV log curve type detection currently treats any column whose preview values are all integer strings as `discrete`. This can classify normal continuous curves like gamma ray as discrete when values are stored as integers.

Discrete should be a stricter classification:

- Numeric integer-only values are not enough by themselves.
- Discrete is appropriate for flag/code curves, lithology/code curves, or columns with explicit keyword/code semantics.
- Continuous should be the safe default for ordinary numeric log curves.

### 4. Reimport Does Not Refresh Curve Type In View State

When a curve is first imported as `discrete`, then reimported with the same mnemonic as `continuous`, the project data should replace the curve metadata and visual behavior. The backend appears to replace same-mnemonic curve metadata, but the UI can still behave as if the old discrete style is retained until the curve is deleted first.

This needs a code review of track curve settings and per-well view state. Curve visual style may persist, but `curve_type` must follow the current project curve metadata after reimport.

### 5. StratChart Optional Fields

StratChart import currently uses `unit_code` in the application, and the backend accepts aliases including `unit_code`, `strat_index`, `unit_abbrev`, and `code`. The frontend mapping list does not expose `unit_code` explicitly, so users cannot clearly map it during import.

All optional attributes that the application actually uses should be available in the import mapping UX. Extra/unrecognized columns still remain user attributes.

### 6. Active StratChart Tree Expansion

The active StratChart node should not auto-expand in Data Manager. The user controls expansion manually.

## Required Behavior

### Mapping

- If a user selects a mapped field in a different column, the previous column assignment is cleared automatically.
- The user should be able to reassign a field in one action.
- Required-field validation should continue to use the final mapping state.
- Backend payloads should stay unchanged: only the final `column_map` is sent.

### CSV Logs

- The mapped depth column should display as `MD` in the mapping row when the trusted/reference depth is MD.
- If the user picks TVD/TVDSS as trusted depth reference, the mapping label should reflect that reference.
- Non-depth, non-well CSV columns should show their imported curve mnemonic instead of `-`.
- Curve type controls should stay available for imported curves.
- Continuous should be the default for numeric curves unless there is a reliable discrete signal or the user explicitly selects `discrete`.
- Reimporting a curve with the same mnemonic must update both stored curve metadata and visible behavior.

### StratChart

- Add explicit frontend mapping support for `unit_code`.
- Keep backend aliases for `unit_code`, `strat_index`, `unit_abbrev`, and `code`.
- Review StratChart mapping fields against currently used `StratUnit` data:
  - `unit_id`
  - `parent_unit_id`
  - `unit_name`
  - `rank_name`
  - `start_age_ma`
  - `end_age_ma`
  - `color`
  - `unit_code`
- Preserve user attributes from extra columns.

### Data Manager

- Do not auto-expand an active StratChart.
- Keep manual expand/collapse behavior stable after unit loading.

## Implementation Plan

1. Finish the small StratChart tree expansion fix and test. Done.
2. Update the shared tabular preview/mapping component so mapped fields can be reassigned in one action. Done.
3. Extend CSV log mapping display so imported curve columns show the curve mnemonic instead of `-`. Done.
4. Adjust CSV log curve type detection to default numeric curves to continuous unless a reliable discrete signal exists.
5. Trace same-mnemonic curve reimport from backend metadata replacement through frontend view state and fix stale curve type behavior.
6. Add `unit_code` to StratChart frontend mapping and tests.
7. Run focused frontend tests for import mapping and Data Manager tree.
8. Run backend import tests if backend payload/import behavior changes.

## Open UX Review

The maintainer will re-check the import workflows before implementation and may add more mapping-related UX fixes to this contract.

## Non-Goals

- No multi-file import in this contract.
- No new database schema in this contract.
- No new user-attribute storage behavior; this contract only ensures mapped optional fields and extra columns are handled consistently.
