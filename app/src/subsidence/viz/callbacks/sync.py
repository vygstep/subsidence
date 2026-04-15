"""Depth-viewport sync callbacks and Sync scales button."""
from __future__ import annotations

import dash
from dash import Input, Output, State

from ..constants import DATASET
from ..plotting import build_well_figure

_DEFAULT_VIEWPORT = {"r0": 2500.0, "r1": 0.0}


def register_sync_callbacks(app: dash.Dash) -> None:

    # Write depth-viewport when user pans/zooms either burial chart.
    # r0 = yaxis.range[0] = bottom of chart (deeper), r1 = top (shallower).
    @app.callback(
        Output("depth-viewport", "data"),
        Input("burial-multi", "relayoutData"),
        Input("burial-selected", "relayoutData"),
        State("depth-viewport", "data"),
        prevent_initial_call=True,
    )
    def update_depth_viewport(multi_relay, selected_relay, current):
        relay = multi_relay or selected_relay
        if not relay:
            return current
        # Double-click reset
        if relay.get("yaxis.autorange") or relay.get("autosize"):
            return _DEFAULT_VIEWPORT
        r0 = relay.get("yaxis.range[0]", current["r0"])
        r1 = relay.get("yaxis.range[1]", current["r1"])
        return {"r0": r0, "r1": r1}

    # Sync well-figure Y axis to depth-viewport.
    # Triggered by viewport change (burial zoom) OR by the Sync scales button.
    @app.callback(
        Output("well-figure", "figure", allow_duplicate=True),
        Input("depth-viewport", "data"),
        Input("fit-to-subsidence", "n_clicks"),
        State("well-selector", "value"),
        prevent_initial_call=True,
    )
    def sync_well_log(viewport, _n_clicks, well_name):
        if not viewport or not well_name:
            return dash.no_update
        payload = DATASET[well_name]
        fig = build_well_figure(
            well_name=well_name,
            strat_intervals=payload["strat"],
            lithology_intervals=payload["lithology"],
            curves=payload["curves"],
        )
        fig.update_yaxes(autorange=False, range=[viewport["r0"], viewport["r1"]])
        return fig

    # Clientside callback — propagates depth-viewport to separate track graphs (Phase 3+).
    app.clientside_callback(
        """
        function(viewport, graphIds) {
            return window.dash_clientside.sync.syncDepthViewport(viewport, graphIds);
        }
        """,
        Output("sync-dummy", "data"),
        Input("depth-viewport", "data"),
        State("track-graph-ids", "data"),
    )
