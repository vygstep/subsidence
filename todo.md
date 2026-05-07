# TODO

## Active import warning bug

Active contract: `docs/contracts/bug-import-warning-panel-delivery.md`

| Item | Title | Status |
|---|---|---|
| BUG-IMPORT-TD-WARN-001 | Import TD-extension QC warnings are missing in some flows | todo |

Details:

- Tops import works and extends well TD when imported tops are deeper than the current well TD, but the QC warning message is not shown in the bottom-right warning panel.
- Deviation import also misses the QC warning when deviation is the first imported data for the well/project.
- Deviation import warning does appear after tops have already been imported first, then deviation is imported.
- Expected warning behavior: any import that extends `well.td_md` should surface a QC warning in the existing warning panel, regardless of import order or imported data type.

Active contract: `docs/contracts/bugs_and_features_4.md`

## BF4 — current sprint

| Item | Title | Status |
|---|---|---|
| BF4-016 | Simplified LAS/CSV import — options on preview, direct Load | done |
| BF4-018 | Unified 2-step import — inline column mapping (Tops/Dev) | done |
| BF4-010 | Move top-management buttons to side track toolbar | done |
| BF4-007-B | Sea level value override per top (backend + UI) | todo |
| BF4-011 | Backend API audit — frontend coverage | todo |
| BF4-019 | Delete log curve / delete all logs from Data Manager | done |
| BF4-020 | Delete deviation survey from Data Manager | done |
| BF4-021 | Rebuild zones after formation top delete | done |
| BF4-025 | Durable per-curve settings and dictionary mnemonic assignment | todo |
| BF4-029 | Edit tops redesign — click-to-place, DM context menu add, cursor tooltip | todo |
| BF4-028 | Stratigraphy redesign — TopSet as primary object, merge-by-marker-name | done |
| BF4-027 | Unconformity model redesign — unified picks with hiatus_duration_ma | done |

## Implemented contracts

See `docs/contracts/implemented/` for the full history of completed contracts.
