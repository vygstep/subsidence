# Data Manager UI System Contract

**Status:** Complete  
**Scope:** Centralize Data Manager styling, tree behavior, reusable UI primitives, and interaction state for `Wells`, `Templates`, `StratCharts`, and future `Models`.

---

## Implemented

### DM-001: Introduce Data Manager Tokens ✓

Centralized `--dm-*` CSS custom properties on `.app-sidebar`: typography (`--dm-font-*`), spacing, radii, `--dm-row-height`, `--dm-indent`, color groups (`--dm-fg`, `--dm-bg`, `--dm-border`, `--dm-accent`, `--dm-danger`), hover/selected/muted states. Commit: `46889d9`.

### DM-002: Context + Full Migration ✓

`DataManagerContext` scoped to `DataManagerPane` — `isExpanded`, `toggleExpanded`, `setExpanded`; all nodes default to collapsed. `WellDataPanel` and `TemplatesTab` removed local expansion `useState`; `StratChartTab` migrated to shared `tree-node__*` CSS vocabulary. Shared row CSS classes: `tree-node`, `tree-node__row`, `tree-node__label-button`, `tree-checkbox-leaf`, `tree-toggle`. Commit: `228dd44`.

Note: React Context was chosen over global store because expansion is scoped UI state, not domain state.

### DM-003: Normalize Compact Actions ✓

`dm-action` system with `--primary`, `--danger`, `--ghost` variants replaces section-specific button styles. Applied across Templates, StratCharts, and Settings. Commit: `5005cee`.

### DM-004: Normalize Settings Tables ✓

`dm-table` / `dm-table--numeric` replaces `compaction-table` and `template-table`. Applied to `CompactionPresetsRootSettings`, `CompactionPresetSettings`, `CompactionPresetDraftSettings`, `LithologySetSettings`, `LithologySetsRootSettings`, `ModelSettings`, `TemplatesTab`. Commit: `d46e09b`.

### DM-005: Interaction Regression Tests ✓

9 tests in `DataManagerTree.integration.test.tsx` covering: collapsed-by-default for Wells and Templates, per-node expand independence, selection callbacks, built-in preset meta label, selected row class. Commit: `00e0fed`.

---

## Acceptance Criteria — Met

- Data Manager expansion state is centralized in `DataManagerContext`. ✓
- All sections start collapsed by default. ✓
- `Wells`, `Templates`, and `StratCharts` share one CSS vocabulary. ✓
- Shared tokens control fonts, spacing, row geometry, and colors. ✓
- Shared table primitives control settings-table rendering. ✓
- Adding a new Data Manager object no longer requires new row/button/table styles. ✓
