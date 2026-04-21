# Subsidence Panel Bug Report

This document records the current known issues in the right-side subsidence panel.

It is intentionally separate from the general backlog so the problem can be revisited
without repeating the investigation.

---

## Scope

Affected UI area:

- right-side subsidence / burial-history panel
- top geologic timescale header above the subsidence chart

Relevant frontend files:

- `frontend/src/components/subsidence/SubsidencePanel.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/components/subsidence/GeologicalTimescale.tsx`
- `frontend/src/utils/geologicalTimescale.ts`
- `frontend/src/stores/computedStore.ts`
- `frontend/src/api/subsidenceSocket.ts`

Relevant backend files:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/data/strat_link.py`
- `app/src/subsidence/data/backstrip.py`

---

## User-visible symptoms

### S1. Top stratigraphic header is not visible

Expected:

- the subsidence panel should show a top geologic / stratigraphic header
- the user expects system + stage information at the top

Observed:

- the top header is often not visible at all
- the panel may show only an empty state

### S2. Right-side chart often does not render anything

Expected:

- if tops are loaded and linked to a stratigraphic chart, a burial/subsidence chart should be available

Observed:

- nothing is drawn in the right-side panel
- the chart area remains empty even when formations exist

### S3. The implemented header is not the expected one

Expected:

- a two-level header with systems and stages

Observed:

- current implementation only supports a single-row broad geologic scale

---

## Root causes

### R1. The top header is hidden together with the canvas

Location:

- `frontend/src/components/subsidence/SubsidencePanel.tsx`

Current behavior:

- `SubsidenceCanvas` is rendered only when `subsidenceCurves.length > 0`
- the geologic header is defined inside `SubsidenceCanvas`

Result:

- if there are no computed curves yet, the header is not mounted either
- the user cannot see any top scale at all

### R2. Subsidence calculation requires both `age_top_ma` and `age_base_ma`

Locations:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/data/backstrip.py`

Current behavior:

- backstrip input filters out formations unless both values are present:
  - `age_top_ma`
  - `age_base_ma`
- if fewer than two valid formations remain, the result is empty

Result:

- many wells with visible tops still produce no subsidence curves

### R3. Auto-linking to a strat chart does not populate the ages needed by backstrip

Location:

- `app/src/subsidence/data/strat_link.py`

Current behavior:

- auto-link attaches a formation to a `StratUnit`
- auto-link may also copy color
- auto-link does not synchronize:
  - `formation.age_top_ma`
  - `formation.age_base_ma`
  from the linked stratigraphic unit

Result:

- formations can be linked and colorized
- but still remain unusable for subsidence calculation

### R4. The current top scale is only a single-row broad period scale

Locations:

- `frontend/src/utils/geologicalTimescale.ts`
- `frontend/src/components/subsidence/GeologicalTimescale.tsx`

Current behavior:

- the UI uses a single hard-coded list of broad geologic periods
- the component renders one row only

Result:

- even after fixing curve calculation, the header will still not match the expected
  system + stage design

### R5. Minor mojibake remains in the subsidence UI strings

Location:

- `frontend/src/components/subsidence/SubsidencePanel.tsx`
- `frontend/src/components/subsidence/GeologicalTimescale.tsx`
- possibly comments or labels in related files

Examples:

- `ComputingвЂ¦`
- `No data вЂ” formation ages required`

Result:

- poor UI polish
- misleading signal that this part of the UI was not fully normalized

---

## Current behavior summary

The right-side panel currently fails for two different reasons:

1. UI composition problem:
- the top scale is hidden when no computed curves exist

2. Data / compute contract problem:
- linked formations frequently do not carry the age interval required by the
  backstrip engine

Additionally, even once these are fixed, the top scale still remains a feature gap:

3. The expected system + stage header is not implemented yet

---

## Suggested fix order

### Fix 1. Always show the top header area

Goal:

- render the top geologic header even when `subsidenceCurves` are empty
- keep the empty-state message only for the plot body

Expected impact:

- user immediately sees that the right-side panel exists
- the panel no longer collapses into a visually empty area

### Fix 2. Make formations usable for subsidence computation

Goal:

- ensure formations linked to the active strat chart have a valid age interval

Possible implementation directions:

- derive `age_top_ma` and `age_base_ma` directly from the active linked `StratUnit`
  at compute time
- or synchronize these values into `FormationTopModel` during linking / relinking

Important note:

- this must be decided explicitly because it affects future editing semantics

### Fix 3. Replace the current one-row scale with a two-level scale

Goal:

- render systems and stages in two rows

Expected source:

- not the current hard-coded `GEOLOGIC_PERIODS` only
- likely chart-derived units, or a dedicated system/stage source

### Fix 4. Normalize the panel strings

Goal:

- remove remaining mojibake from this UI area

---

## Open design questions

### Q1. Where should the age interval for backstrip come from?

Options:

- from formation fields stored on the top itself
- from the active linked stratigraphic unit at compute time
- from a synchronized copy that updates on relink

### Q2. What should the top header use as its source of truth?

Options:

- hard-coded geologic table
- active strat chart
- active chart plus special system/stage aggregation logic

### Q3. Should the header be visible even when there is no well or no valid data?

Current recommendation:

- yes, keep the header area visible whenever the subsidence panel is mounted

---

## Minimum acceptance criteria

For this bug group to be considered resolved:

1. The right-side panel shows a visible top header even before successful computation.
2. Linked tops with valid stratigraphic ages produce subsidence curves.
3. The panel no longer stays empty when formations are properly linked.
4. UI mojibake is removed from this panel.
5. A follow-up implementation exists for a real two-level system + stage header.
