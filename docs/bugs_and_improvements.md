# Bugs and Improvements Backlog

This file is a normalized working backlog for post-cleanup Phase 3 fixes and UX improvements.

It is not a contract. It is a grouped execution list that can be handled pass by pass.

---

## Pass 1 - Bugfixes

These items should be handled first because they affect correctness and trust in the UI.

### B4. `Set type` must use predefined formation types

Problem:

- `Set type` is too free-form

Expected result:

- user chooses formation type from a predefined list
- no free-text type editing in the standard flow

---

## Pass 2 - Import Behavior

These items affect data-loading correctness and should be handled after the core bugfixes.

### I1. Duplicate well protection during import

Problem:

- when loading LAS or tops, if a well with the same name already exists, the app may create another well silently

Expected result:

- if a matching well already exists, reuse it by default
- creating a second well with the same name must require explicit user intent
- import UI should expose a deliberate option such as:
  - `Create new well`

---

## Pass 3 - Toolbar and Object Management UX

These items change interaction layout and object actions.

### U1. Toolbar reorganization

Requested behavior:

- remove the main `Project` mode button
- place static project actions on the second row, left-aligned:
  - `New project`
  - `Open project`
  - `Close project`
  - `Save project`
- use icon-first presentation for these static actions later

- remove the main buttons:
  - `StratChart`
  - `Wells`
  - `Tops`

- instead, activate/show contextual actions according to the active `Data Manager` panel

#### When `StratCharts` panel is active

Visible actions:

- `Load StratChart`
- `Delete StratChart`

#### When `Wells` panel is active

Visible actions:

- `Create well`
- `Load logs`
- `Load tops`
- `Load deviation`
- `Delete well`
- `Add top`
- `Link top`
- `Set type`
- `Delete top`
- `Delete all tops`
- `Move top`

### U2. Rename with `F2`

Requested behavior:

- pressing `F2` on a selected object should rename that object

### U3. Right-click object menu

Requested behavior:

- right click on an object should open a context menu with:
  - `Duplicate`
  - `Delete`
  - `Rename`

### U4. Explorer-style folder picker affordance

Requested behavior:

- when opening a project or loading data, add a folder/explorer icon to help choose or reveal the path
- last opened root should be remembered

---

## Pass 4 - Viewer and Track Improvements

These items improve viewer usability and move toward later Compass interaction quality.

### V1. Thinner stratigraphy color bands

Requested behavior:

- stratigraphy colored areas should be at least 50% thinner

### V2. Track reordering by drag

Requested behavior:

- track positions should be changed by drag-and-drop reordering

### V3. Curve mnemonic visual library

Requested behavior:

- add a curve mnemonic library
- use mnemonic-based defaults for:
  - color
  - line type
  - thickness
  - limits
  - precision
  - scale

---

## Recommended execution order

1. Pass 1 - Bugfixes
2. Pass 2 - Import Behavior
3. Pass 3 - Toolbar and Object Management UX
4. Pass 4 - Viewer and Track Improvements

Within each pass, handle one item at a time and stop for confirmation before the next item.
