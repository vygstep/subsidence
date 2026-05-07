# BUG: Import Warning Panel Delivery

## Status

`todo`

## Problem

Import can update well TD correctly, but some TD-extension QC warnings do not reach the bottom-right warning panel in the UI.

Observed behavior:

- Tops import works and extends well TD when imported tops are deeper than the current well TD, but the QC warning message is not shown in the warning panel.
- Deviation import misses the QC warning when deviation is the first imported data for the well/project.
- Deviation import warning does appear after tops have already been imported first, then deviation is imported.

## Desired Behavior

Any import that extends `well.td_md` should surface a QC warning in the existing warning panel, regardless of import order or imported data type.

Expected warning example:

`Imported data extends below current TD 6000.0 m; TD was updated to 8000.0 m.`

Applies to:

- Tops import
- Deviation import

## Investigation Notes

The backend TD-extension logic and targeted tests for TD updates pass. The remaining issue appears to be warning delivery/state handling in UI flows or import response handling for specific import orders.

## Verification

- Import tops deeper than current TD into a well with no prior data and confirm the warning appears in the bottom-right warning panel.
- Import deviation deeper than current TD as the first imported data and confirm the warning appears.
- Import tops first, then deviation deeper than TD, and confirm warnings still appear.
