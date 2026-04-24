# Data Manager UI System Contract

**Status:** Active  
**Scope:** Centralize Data Manager styling, tree behavior, reusable UI primitives, and interaction state for `Wells`, `Templates`, `StratCharts`, and future `Models`.

---

## 1. Problem Statement

The current Data Manager UI works, but its behavior and styling are fragmented.

Observed implementation issues:

- Visual styling is spread across unrelated CSS groups in `frontend/src/styles/data-manager.css`:
  - `tree-*`
  - `template-section*`
  - `strat-chart-item*`
  - panel/table/button helpers
- Similar object rows are rendered by different markup patterns instead of shared primitives:
  - `WellDataPanel.tsx`
  - `TemplatesTab.tsx`
  - `StratChartTab.tsx`
- Expand/collapse state is not centralized:
  - `WellDataPanel.tsx` keeps `expandedNodes` in local `useState`
  - `TemplatesTab.tsx` uses local `useState(defaultOpen)`
  - `StratChartTab.tsx` has no shared tree-state model at all
- Initial collapse behavior is inconsistent:
  - `Wells` starts collapsed
  - `Templates` opens sections based on component defaults
- Selection, active state, built-in muted state, and row interaction patterns are implemented differently across sections.
- Tables in `Settings` are partially standardized, but still rely on section-specific classes rather than a small reusable system.

Without centralization, each new Data Manager object adds more custom CSS and more one-off interaction logic. This raises maintenance cost and increases visual drift.

---

## 2. Goals

1. Create one Data Manager design system instead of section-by-section styling.
2. Make tree behavior consistent across `Wells`, `Templates`, `StratCharts`, and future `Models`.
3. Enforce one initial interaction rule:
   - all Data Manager sections and nested nodes are collapsed by default.
4. Centralize visual tokens:
   - typography
   - spacing
   - control sizing
   - borders
   - colors
   - radii
5. Introduce reusable row/table/action primitives so new objects do not require new styling patterns.
6. Move expand/collapse state into a shared store model instead of local component state.
7. Preserve existing functionality while migrating incrementally.

---

## 3. Non-Goals

This contract does **not** include:

- visual redesign of the whole application outside Data Manager;
- dark theme support;
- replacing existing object domain logic;
- changing import/model workflows;
- subsidence chart styling outside Data Manager;
- major rewrite of `Settings` content editors beyond shared table/row patterns.

---

## 4. Required Behavior

### 4.1 Global Interaction Rules

- All Data Manager tree sections start collapsed by default.
- This applies to:
  - `Wells`
  - `Templates`
  - `StratCharts`
  - future `Models`
- Newly created or copied objects may open themselves automatically, but existing sibling branches must stay unchanged.
- Selection state and expand/collapse state are separate concepts.
- Selecting an object must not implicitly expand unrelated branches.
- Hover, selected, active, built-in, and danger states must follow one shared semantic system.

### 4.2 Shared Tree Model

The Data Manager needs one centralized tree-state model.

Minimum capabilities:

- check if a node is expanded;
- expand/collapse one node;
- collapse all;
- restore default collapsed state;
- optionally persist expansion state during the current session;
- support future persistence if required.

Tree node keys must be deterministic and stable.

Examples:

- `well:<wellId>`
- `well:<wellId>:logs`
- `well:<wellId>:tops`
- `template:compaction-presets`
- `template:lithologies`
- `template:lithologies:set:<setId>`
- `strat-chart:<chartId>`

### 4.3 Shared Visual Tokens

Data Manager tokens must be centralized, preferably in CSS custom properties at the Data Manager root.

Minimum token groups:

- font sizes
- font weights
- uppercase/letter spacing settings
- row height
- inline control size
- indentation per tree level
- panel padding
- table cell padding
- border color
- muted foreground color
- active/selected background
- hover background
- built-in background/muted style
- danger color
- border radius

### 4.4 Shared Row Primitives

Data Manager should expose reusable row patterns instead of section-specific markup styles.

Minimum primitives:

- root row
- section row
- leaf row
- checkbox leaf row
- radio/selectable leaf row
- built-in muted row
- selected row
- row meta area
- row action area

These primitives must be usable by:

- `WellDataPanel`
- `TemplatesTab`
- `StratChartTab`
- future `Models` tree

### 4.5 Shared Tables in Settings

The Data Manager system must define one reusable settings-table pattern.

Minimum shared table behavior:

- standard header style;
- standard cell padding;
- standard editable cell input;
- standard editable select cell;
- read-only row style;
- built-in muted row style;
- selected row style where needed;
- compact action cell;
- consistent empty-state row/message style.

This table system must support:

- compaction presets
- lithology sets
- future mnemonic sets
- future dictionary sets

### 4.6 Shared Compact Actions

Inline actions and secondary buttons must use one compact pattern.

Minimum variants:

- primary compact action
- secondary compact action
- inline action
- delete/danger action
- disabled action

These actions must visually match across:

- `Templates`
- `StratCharts`
- `Settings`
- future Data Manager object panels

---

## 5. Current Code Findings

### 5.1 Tree State Fragmentation

`frontend/src/components/layout/WellDataPanel.tsx`

- owns `expandedNodes` via local `useState`
- resets local expansion when well list changes

`frontend/src/components/layout/TemplatesTab.tsx`

- each `TemplateSection` owns its own local `isOpen`
- `defaultOpen` is component-local, not a global policy

`frontend/src/components/layout/StratChartTab.tsx`

- uses a flat list item style
- does not share a generalized tree-state abstraction

`frontend/src/stores/workspaceStore.ts`

- has sidebar/layout state
- does **not** yet own Data Manager expansion state

### 5.2 Styling Fragmentation

`frontend/src/styles/data-manager.css` currently mixes multiple systems:

- tree rows and toggles
- template sections
- strat chart list items
- template tables
- compaction tables
- panel/action helpers

This file is functioning as a stylesheet dump, not as a structured design system.

### 5.3 Reusable Semantics Missing

Semantics exist conceptually but not structurally:

- `selected`
- `active`
- `builtin`
- `muted`
- `danger`
- `hover`

These states are re-expressed differently in each section.

---

## 6. Target Architecture

### 6.1 Store Layer

Add centralized Data Manager UI state to `workspaceStore.ts` or a dedicated UI store.

Recommended state shape:

- `expandedDataManagerNodes: Record<string, boolean>`
- helper actions:
  - `isNodeExpanded(nodeId)`
  - `setNodeExpanded(nodeId, expanded)`
  - `toggleNodeExpanded(nodeId)`
  - `collapseAllDataManagerNodes()`
  - `resetDataManagerExpansion()`

Optional later extension:

- persist per project/session;
- auto-expand newly created object only.

### 6.2 Component Layer

Introduce reusable primitives under `frontend/src/components/layout/dataManager/` or equivalent.

Recommended primitives:

- `DataManagerTreeNode`
- `DataManagerRow`
- `DataManagerToggle`
- `DataManagerLeaf`
- `DataManagerMeta`
- `DataManagerInlineAction`
- `DataManagerSettingsTable`

These primitives should replace one-off section patterns over time.

### 6.3 CSS Layer

Restructure `data-manager.css` into sections or split files while keeping one source of truth.

Recommended layers:

1. tokens
2. panels
3. tree primitives
4. row states
5. table primitives
6. compact actions
7. section-specific adapters only where truly needed

### 6.4 Section Migration Model

Each Data Manager area should be migrated onto the shared system.

Migration targets:

- `Wells`
- `Templates`
- `StratCharts`
- future `Models`

Each section may still render different domain data, but must use the same row/table/action vocabulary.

---

## 7. Implementation Plan

### DM-001: Introduce Data Manager Tokens

Create centralized CSS tokens for:

- typography
- spacing
- radii
- row height
- colors
- borders
- hover/selected states
- builtin/muted states

Acceptance:

- shared visual constants are declared once;
- section CSS reads from tokens instead of hardcoded values where possible.

### DM-002: Context + Shared Row Primitives + Full Migration

Tree expansion state is UI state, not domain state. It belongs in a React Context scoped to `DataManagerPane`, not in a global store.

**2a — Expansion Context**

Create `DataManagerContext` inside `DataManagerPane`:

- `isExpanded(nodeId: string): boolean`
- `setExpanded(nodeId: string, expanded: boolean): void`
- `toggleExpanded(nodeId: string): void`
- `collapseAll(): void`
- all nodes default to collapsed

Node key convention:
- `well:<wellId>`
- `well:<wellId>:logs`
- `well:<wellId>:tops`
- `well:<wellId>:dev`
- `well:<wellId>:metadata`
- `template:compaction-presets`
- `template:lithologies`
- `template:lithologies:set:<setId>`
- `strat-chart:<chartId>`

Acceptance:
- `WellDataPanel` no longer owns `expandedNodes` locally;
- `TemplatesTab` no longer owns open state per section locally;
- all sections read expansion from the same context.

**2b — Shared Row Primitives**

Create reusable primitives under `frontend/src/components/layout/dataManager/`:

- `DataManagerRow` — base row with toggle slot, checkbox/radio slot, label slot, meta slot, action slot
- `DataManagerLeaf` — leaf row without toggle, with checkbox slot and selectable label button
- `DataManagerMeta` — inline secondary text (unit, depth, count)
- `DataManagerToggle` — expand/collapse chevron button
- `DataManagerInlineAction` — small inline icon/text action button

Acceptance:
- primitives cover all row patterns seen in `Wells`, `Templates`, `StratCharts`;
- row selection, active, built-in, and muted states are expressed through shared CSS modifier classes.

**2c — Full Section Migration**

Migrate all three sections onto the shared context + primitives in the same step:

- `WellDataPanel` — wells, logs, tops, deviation rows
- `TemplatesTab` — compaction presets, curve mnemonics, lithologies sections
- `StratChartTab` — chart list rows

Acceptance:
- no section-local expansion `useState` remains;
- all sections start collapsed by default;
- no visual regression in selection or active states.

### DM-003: Normalize Compact Actions

Unify inline buttons and small actions.

Acceptance:

- `+ New`, `Make copy`, `Rename`, `Delete`, section actions, and other compact buttons use one shared action system;
- visual appearance is consistent across `Templates`, `StratCharts`, `Settings`.

### DM-004: Normalize Settings Tables

Introduce one reusable Data Manager settings-table style layer.

Acceptance:

- compaction preset tables;
- lithology tables;
- future mnemonic tables;

all share one standard header/cell/input/select/action system.

### DM-005: Add Interaction Regression Tests

Add tests for:

- initial collapsed state in `Wells`
- initial collapsed state in `Templates`
- selection does not auto-expand unrelated branches
- expanding/collapsing one node affects only that node
- built-in muted row styling presence
- shared row/table classes applied to all target sections

Acceptance:

- regressions in expansion policy and selection semantics are covered.

---

## 8. Acceptance Criteria

This contract is complete when:

- Data Manager expansion state is centralized in a scoped React Context.
- All sections start collapsed by default.
- `Wells`, `Templates`, and `StratCharts` no longer rely on separate styling systems.
- Shared tokens control fonts, spacing, row geometry, and colors.
- Shared row primitives control tree/list item rendering.
- Shared table primitives control settings-table rendering.
- Adding a new Data Manager object no longer requires inventing new row/button/table styles from scratch.

---

## 9. Risks and Constraints

- Migration must not break current object selection and context-menu behavior.
- Existing CSS can be refactored incrementally, but the end state must reduce duplication rather than add another parallel layer.
- Built-in vs user semantics must remain explicit during the migration.
- Section-specific domain content is allowed, but section-specific row systems are not.

---

## 10. Execution Order

1. `DM-001` — tokens
2. `DM-002` — Context + row primitives + full section migration (Wells, Templates, StratCharts)
3. `DM-003` — compact actions
4. `DM-004` — settings tables
5. `DM-005` — regression tests
