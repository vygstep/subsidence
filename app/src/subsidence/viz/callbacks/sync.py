"""Depth viewport sync callbacks."""
from __future__ import annotations

import re

import dash
from dash import ClientsideFunction, Input, Output, State, ctx

_DEFAULT_VIEWPORT = {"r0": 2500.0, "r1": 0.0}
_SYNC_GRAPH_IDS = {"burial-multi", "burial-selected", "well-figure"}
_RANGE0_RE = re.compile(r"^(yaxis\d*)\.range\[0\]$")


def _extract_viewport(relayout: dict | None) -> dict[str, float] | None:
    if not relayout:
        return None

    if relayout.get("autosize"):
        return dict(_DEFAULT_VIEWPORT)

    for key, value in relayout.items():
        if key.startswith("yaxis") and key.endswith(".autorange") and value:
            return dict(_DEFAULT_VIEWPORT)

    axis_name = None
    r0 = relayout.get("yaxis.range[0]")
    r1 = relayout.get("yaxis.range[1]")
    if r0 is not None and r1 is not None:
        axis_name = "yaxis"
    else:
        for key in relayout:
            match = _RANGE0_RE.match(key)
            if not match:
                continue
            candidate_axis = match.group(1)
            candidate_r0 = relayout.get(f"{candidate_axis}.range[0]")
            candidate_r1 = relayout.get(f"{candidate_axis}.range[1]")
            if candidate_r0 is not None and candidate_r1 is not None:
                axis_name = candidate_axis
                r0 = candidate_r0
                r1 = candidate_r1
                break

    if axis_name is None:
        for candidate_axis in ["yaxis", "yaxis2", "yaxis3", "yaxis4", "yaxis5"]:
            axis_range = relayout.get(f"{candidate_axis}.range")
            if isinstance(axis_range, (list, tuple)) and len(axis_range) == 2:
                r0, r1 = axis_range
                axis_name = candidate_axis
                break

    if axis_name is None or r0 is None or r1 is None:
        return None
    return {"r0": float(r0), "r1": float(r1)}


def _same_viewport(left: dict[str, float], right: dict[str, float]) -> bool:
    return abs(left["r0"] - right["r0"]) < 1e-9 and abs(left["r1"] - right["r1"]) < 1e-9


def register_sync_callbacks(app: dash.Dash) -> None:

    @app.callback(
        Output("sync-enabled", "data"),
        Output("sync-scales-toggle", "color"),
        Output("sync-scales-toggle", "outline"),
        Input("sync-scales-toggle", "n_clicks"),
        State("sync-enabled", "data"),
        prevent_initial_call=True,
    )
    def toggle_sync_scales(_n_clicks, enabled):
        next_enabled = not bool(enabled)
        return next_enabled, ("primary" if next_enabled else "secondary"), (not next_enabled)

    @app.callback(
        Output("depth-viewport", "data"),
        Input("burial-multi", "relayoutData"),
        Input("burial-selected", "relayoutData"),
        Input("well-figure", "relayoutData"),
        State("sync-enabled", "data"),
        State("depth-viewport", "data"),
        prevent_initial_call=True,
    )
    def update_depth_viewport(multi_relayout, selected_relayout, well_relayout, sync_enabled, current):
        if not sync_enabled:
            return dash.no_update

        triggered_id = ctx.triggered_id
        if triggered_id not in _SYNC_GRAPH_IDS:
            return dash.no_update

        relay_map = {
            "burial-multi": multi_relayout,
            "burial-selected": selected_relayout,
            "well-figure": well_relayout,
        }
        viewport = _extract_viewport(relay_map.get(triggered_id))
        if viewport is None:
            return dash.no_update

        current_viewport = current or _DEFAULT_VIEWPORT
        if _same_viewport(viewport, current_viewport):
            return dash.no_update
        return viewport

    app.clientside_callback(
        ClientsideFunction(namespace="syncScales", function_name="applyViewport"),
        Output("sync-dummy", "data"),
        Input("depth-viewport", "data"),
        State("sync-enabled", "data"),
        State("track-graph-ids", "data"),
    )
