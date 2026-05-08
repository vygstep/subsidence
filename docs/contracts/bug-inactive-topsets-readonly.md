# Bug: Inactive TopSets Must Be Visible But Read-only

Status: active

## Problem

When a well has multiple TopSets loaded/visible, inactive TopSet markers can still be edited in `edit tops` mode. Users can select, drag, or otherwise mutate markers from a TopSet that is not active for the current well.

Inactive TopSet tree data also regressed: inactive TopSets are listed from `/api/top-sets`, but that summary does not expose horizon rows. The Data Manager can therefore show stale active-set markers or `No markers loaded` for an inactive TopSet even when that TopSet has its own marker set.

Visibility and editability are currently coupled too loosely:

- visible inactive TopSet markers are useful as reference context;
- inactive TopSet markers must not be mutable from track interactions.

## Expected Behavior

1. Active TopSet markers for the current well remain editable in `edit tops` mode.
2. Inactive TopSet markers may remain visible if the user has toggled them on.
3. Inactive TopSet markers are read-only:
   - no active pick selection;
   - no drag;
   - no delete/backspace clear;
   - no ghost placement workflow.
4. Data Manager visibility toggles may still show/hide inactive TopSets, markers, and zones.
5. Inactive TopSet rows in Data Manager show their own marker names from `TopSetHorizon`, not the active set's marker names.
6. Inactive TopSet marker checkboxes are enabled when the current well has linked picks for that TopSet.
7. Existing active TopSet picking and ghost workflows continue to work.

## Non-goals

- No database schema change.
- No deletion or migration of inactive picks.
- No redesign of TopSet activation.

## Implementation Plan

1. Expose TopSet horizons in TopSet summary responses so inactive sets have their own marker rows.
2. Build Data Manager inactive TopSet marker rows from `TopSetSummary.horizons`.
3. Trace how visible formations are assembled for the viewer.
4. Identify active TopSet membership for current well.
5. Pass editability separately from visibility into track marker rendering.
6. Make inactive linked markers render as visible/read-only lines.
7. Keep ghost/placement interactions limited to active TopSet picks.
8. Add tests for inactive TopSet marker display and active vs inactive marker editability.
9. Keep Data Manager marker visibility based on `horizon_id` links so inactive TopSet picks can be shown/hidden without activating the TopSet.

## Verification

- With two TopSets visible for one well, inactive markers render but cannot be selected or dragged.
- Inactive TopSet tree expansion shows that TopSet's own markers instead of `No markers loaded`.
- Inactive TopSet marker checkboxes can show/hide linked picks for the current well.
- Active markers still support select, drag, delete-to-ghost, and ghost placement.
- Data Manager visibility toggles still affect inactive TopSet display.
