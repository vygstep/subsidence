# Import User Attributes

Status: Active
Branch: feature/import-user-attributes

## Goal

Preserve user-provided columns that are not part of the core import schema instead of silently dropping them. Imported user attributes must stay data-only, round-trip through export where practical, and not become UI settings.

## Scope

1. Wells CSV
   - Store unknown non-empty columns in `WellModel.extra`.
   - Continue supporting existing `extra_*` columns.
   - Export dynamic `extra_*` columns instead of a fixed allow-list.

2. LAS well metadata
   - Store available LAS `~Well` header values in `WellModel.extra`.
   - Preserve existing normalized keys such as company, field, location, api, country, and original well name.
   - Avoid duplicating core fields as user attributes.

3. Tops CSV
   - Store unknown non-empty columns on each imported top/pick.
   - Export top user attributes as extra CSV columns.
   - Do not treat computed export columns such as zone thickness as imported user attributes.

4. StratChart CSV
   - Store unknown non-empty columns on each stratigraphic unit.
   - Export strat unit user attributes as extra CSV columns.

5. Sea level curve CSV
   - Store unknown non-empty columns on each sea level point.
   - Export point user attributes as extra CSV columns.

6. Deviation CSV
   - Preserve additional numeric columns in the deviation payload and export them back.
   - Do not add a text attribute model for deviation in this contract.

## Non-Goals

- No UI for editing user attributes.
- No interpretation of user attributes in calculations.
- No LAS curve/header user-attribute UI.
- No migration support for older development projects.

## Acceptance

- Unknown non-empty columns survive import/export round-trip for wells, tops, StratCharts, and sea level curves.
- LAS `~Well` header metadata is stored in well extra metadata.
- Logs CSV behavior remains unchanged: non-depth columns remain curve candidates.
- Tests cover the new storage and export behavior.
