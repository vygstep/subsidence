"""Well log track callbacks."""
from __future__ import annotations

import dash
from dash import Input, Output, State

from ..constants import DATASET
from ..plotting import (
    build_depth_track_figure,
    build_lithology_track_figure,
    build_log_track_figure,
    build_strat_track_figure,
)


def register_well_log_callbacks(app: dash.Dash) -> None:

    @app.callback(
        Output("track-strat", "figure"),
        Output("track-lithology", "figure"),
        Output("track-log", "figure"),
        Output("track-depth", "figure"),
        Input("well-selector", "value"),
        State("depth-viewport", "data"),
    )
    def update_well_tracks(well_name: str, viewport):
        payload = DATASET[well_name]
        strat_intervals = payload["strat"]
        lithology_intervals = payload["lithology"]
        curves = payload["curves"]

        if viewport:
            min_depth = float(viewport["r1"])
            max_depth = float(viewport["r0"])
        else:
            depth_values = [0.0]
            for interval in strat_intervals:
                depth_values.extend([interval.top_m, interval.base_m])
            for interval in lithology_intervals:
                depth_values.extend([interval.top_m, interval.base_m])
            for curve in curves:
                depth_values.extend(curve.depths_m)
            min_depth = min(depth_values)
            max_depth = max(depth_values + [2500.0])

        return (
            build_strat_track_figure(strat_intervals=strat_intervals, min_depth=min_depth, max_depth=max_depth),
            build_lithology_track_figure(lithology_intervals=lithology_intervals, min_depth=min_depth, max_depth=max_depth),
            build_log_track_figure(curves=curves, min_depth=min_depth, max_depth=max_depth),
            build_depth_track_figure(min_depth=min_depth, max_depth=max_depth),
        )
