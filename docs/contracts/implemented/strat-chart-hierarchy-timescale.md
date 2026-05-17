# StratChart Hierarchy And Timescale Source Of Truth

Status: Implemented
Branch: feature/strat-chart-hierarchy-timescale

## Goal

Make the active StratChart the single source of truth for geological timescale rendering, marker linking context, and stratigraphic hierarchy validation.

The current implementation stores StratChart units in the database, but parts of the subsidence timescale still use frontend hardcoded era/period data. This contract replaces that mixed behavior with an active-StratChart-driven model.

## Current Problems

- `StratUnit.rank` is currently a text field, so the application cannot reliably validate geological hierarchy semantics.
- Import validation checks parent existence and age containment, but does not fully validate rank order.
- Subsidence chart timescale rendering still depends on frontend hardcoded geological units.
- Active StratChart is already used for model cutoffs and marker linking, so timescale rendering should use the same source.
- User StratCharts can have incomplete hierarchy levels, especially in Precambrian intervals where an `Age`/`Stage` rank may not exist.

## Required Behavior

### 1. Active StratChart Is The Source Of Truth

- The active StratChart in the project database drives geological timescale rendering.
- Built-in ICS is just the default active StratChart seeded into a new project.
- Frontend hardcoded geological timescale constants must not be the primary rendering source.
- If the active StratChart cannot be loaded, the UI should show a clear warning instead of silently rendering unrelated hardcoded data.

### 2. Rank Semantics And Validation

Known geological ranks must have an ordered hierarchy.

Initial known rank order should support common synonyms:

- `eon`
- `era`, `erathem`
- `period`, `system`
- `epoch`, `series`
- `age`, `stage`

Import validation must reject inconsistent hierarchy with line-level errors when possible:

- missing parent references;
- cyclic parent references;
- child age interval outside parent age interval;
- child rank equal to parent rank;
- child rank higher/coarser than parent rank;
- unknown rank when no user-defined rank order is available.

Example error style:

```text
StratChart is inconsistent at line 42: Stage cannot be parent of System.
```

### 3. User-Defined Ranks

User-defined ranks are allowed, but they require an explicit order before hierarchy validation can be trusted.

First implementation can be conservative:

- known rank names use the built-in order;
- unknown rank names fail import with a clear message;
- a future extension can add a user-defined rank-order editor/import field.

### 4. StratCharts Tab Tree

The StratCharts tab should expose the active StratChart as an inspectable tree.

The tree should show real stratigraphic units, not only rank groups.

Example:

```text
STRAT CHARTS
  ICS 2023
    Phanerozoic [Eon]
      Paleozoic [Era]
        Devonian [System]
          Late Devonian [Series]
```

The tree should make nesting visually clear and should help users diagnose imported hierarchy errors.

### 5. Timescale Display Settings

Settings for the active StratChart should allow choosing up to two ranks for subsidence chart timescale rendering:

- `Timescale upper level`
- `Timescale lower level`
- `Labels`: `Auto`, `Unit name`, or `Unit code`

Maximum visible levels for this implementation: `2`.

These settings belong to the StratChart settings context, not per well.

Default display levels:

- upper level: `erathem`;
- lower level: `system`.

`Auto` labels use the StratChart unit code when available and fall back to the unit name/abbreviated label when a code is not available.

### 6. Sparse Hierarchy And Precambrian Display

Some intervals, especially Precambrian, may not contain the selected lower display rank.

Rendering rule:

- Try to render the selected upper and lower ranks.
- If the selected lower rank is missing in part of the active StratChart, use the nearest available unit rank inside the same parent interval for display only.
- This fallback must not mutate imported ranks or parent-child relationships.
- The UI should warn when fallback display is active:

```text
Some intervals do not contain the selected lower rank; nearest available units will be used for display.
```

### 7. Subsidence Charts

Both single-well and multi-well subsidence chart timescales must use the active StratChart.

The visible time range should clip StratChart blocks to the chart age domain.

Global model settings such as reconstruction/truncation by StratUnit should continue to use the active StratChart.

Model cutoff dropdown behavior:

- `None` means no reconstruction/truncation cutoff is active.
- `Show visible` lists only StratChart units visible in the selected lower timescale row and within the current model/well data age range.
- `Show all` lists every unit from the active StratChart.
- Precambrian/sparse-hierarchy fallback units can appear in `Show visible` when they are the rendered lower-row units.

## Non-Goals

- Do not implement a full custom rank editor in the first pass.
- Do not support more than two rendered timescale levels in the first pass.
- Do not change TopSet marker semantics.
- Do not rewrite marker-to-StratChart linking unless required by hierarchy validation.

## Implementation Stages

### Stage 1 - Code And Data Inventory

- Done. Reviewed current StratChart schema, import endpoint, Data Manager tree, settings, and subsidence timescale rendering.
- Done. Confirmed frontend hardcoded timescale usage.
- Done. Identified the minimum API shape needed for rendering active StratChart units by rank.

### Stage 2 - Backend Validation

- Done. Added rank order normalization for known ranks.
- Done. Improved StratChart import validation with line-aware errors.
- Done. Validated hierarchy order, cycles, missing parents, and age containment.
- Done. Added backend tests for valid ICS-like hierarchy and invalid rank/parent cases.

### Stage 3 - Active StratChart Timescale API

- Done. Extended API response so frontend can fetch active chart units with parent/rank/age/color.
- Done. Kept responses compatible with current cutoff controls.
- Done. Added tests for active chart unit fields.

### Stage 4 - StratCharts Tree UI

- Done. Rendered StratChart units as a real hierarchy in the StratCharts tab.
- Done. Showed rank labels and colors.
- Done. Kept built-in/delete/activate behavior unchanged.

### Stage 5 - Timescale Settings

- Done. Added StratChart settings for `Timescale upper level` and `Timescale lower level`.
- Done. Added reset buttons for default `erathem` / `system` display levels.
- Done. Added label mode setting: `Auto`, `Unit name`, `Unit code`.
- Done. Persisted settings in project visual/config state.
- Done. Limited selection to ranks present in the active chart.

### Stage 6 - Subsidence Timescale Rendering

- Done. Replaced frontend hardcoded geological timescale source with active StratChart data.
- Done. Applied selected upper/lower levels.
- Done. Implemented sparse hierarchy fallback for Precambrian/incomplete intervals.
- Done. Applied to both single-well and multi-well subsidence charts.
- Done. Removed the debug/status label from the subsidence chart.
- Done. Updated global model cutoff dropdowns to use active StratChart units with `None`, `Show visible`, and `Show all` modes.

### Stage 7 - Verification

- Done. Backend `pytest tests`: 156 passed.
- Done. Frontend `npm run test -- --run`: 88 passed.
- Done. Added unit coverage for sparse lower-rank fallback without mutating source data.
- Done. Added frontend coverage for StratChart reference hydration and label modes.
