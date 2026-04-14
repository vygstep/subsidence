# Visualization Module

## Purpose

The `subsidence.viz` package provides the current MVP user interface for well-log viewing. It is designed around Dash for application layout and Plotly for synchronized depth-based plotting.

## Files

### `plotting.py`

Contains the plotting primitives and the figure builder.

Dataclasses:

- `StratInterval` — one stratigraphic interval with top/base depth, age range, and display color
- `CurveTrack` — one plotted curve with values, depth samples, unit, and color

Main function:

- `build_well_figure()` creates a two-column Plotly figure

Current layout produced by `build_well_figure()`:

- left track: stratigraphic column rendered as stacked bars
- right track: one or more log curves rendered as line traces
- shared reversed Y axis for depth alignment
- hover templates for interval ages and curve values

### `app.py`

Defines the Dash application entrypoint.

Current responsibilities:

- builds a synthetic in-memory demo dataset for two wells
- creates a simple dashboard layout with a well selector and graph
- wires a callback that rebuilds the Plotly figure when the selected well changes

## Current Status

This package is suitable for a demo and UI prototyping phase, but it is not yet connected to the real data loaders or backend API.

## Inputs and Outputs

Inputs:

- `StratInterval` lists
- `CurveTrack` lists
- selected well name from Dash UI state

Output:

- a Plotly `Figure` object displayed in Dash

## Current Gaps

- demo data is hard-coded in `app.py`
- no integration with `subsidence.data`
- no API calls to the FastAPI backend
- no burial-history or subsidence plots yet
- no multi-track layout logic for larger curve sets
