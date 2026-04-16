"""UI state callbacks — tab switching, modal toggles, object manager."""
from __future__ import annotations

import dash
from dash import Input, Output, State, ctx

from ..constants import CLEAR_OPTIONS, DATASET, MODAL_IDS


def register_ui_state_callbacks(app: dash.Dash) -> None:

    @app.callback(Output("debug-viewport", "children"), Input("depth-viewport", "data"))
    def show_viewport(viewport):
        if not viewport:
            return "—"
        return f"r0={viewport['r0']:.1f}  r1={viewport['r1']:.1f}"

    @app.callback(Output("object-manager-list", "children"), Input("well-selector", "value"))
    def update_object_manager(well_name: str):
        import dash_bootstrap_components as dbc
        payload = DATASET[well_name]
        return [
            dbc.ListGroupItem(f"Well: {well_name}"),
            dbc.ListGroupItem(f"Burial curves: {len(payload['burial_curves'])}"),
            dbc.ListGroupItem(f"Stratigraphy intervals: {len(payload['strat'])}"),
            dbc.ListGroupItem(f"Lithology intervals: {len(payload['lithology'])}"),
            dbc.ListGroupItem(f"Log tracks: {len(payload['curves'])}"),
            dbc.ListGroupItem("Deviation survey: not loaded"),
        ]

    @app.callback(
        Output("one-d-wrapper", "style"),
        Output("two-d-wrapper", "style"),
        Input("modelling-tabs", "active_tab"),
    )
    def switch_modelling_tabs(active_tab: str):
        if active_tab == "tab-2d":
            return {"display": "none"}, {"display": "block"}
        return {"display": "block"}, {"display": "none"}

    @app.callback(
        Output("create-well-manual-fields", "style"),
        Output("create-well-file-fields", "style"),
        Input("create-well-mode", "value"),
    )
    def toggle_create_well_mode(mode: str):
        if mode == "file":
            return {"display": "none"}, {"display": "block"}
        return {"display": "block"}, {"display": "none"}

    @app.callback(
        Output("clear-well-data-options", "value"),
        Input("clear-well-select-all", "n_clicks"),
        State("clear-well-data-options", "value"),
        prevent_initial_call=True,
    )
    def toggle_clear_well_select_all(_n_clicks: int, current_values: list[str]):
        all_values = [option["value"] for option in CLEAR_OPTIONS]
        if set(current_values) == set(all_values):
            return []
        return all_values

    @app.callback(Output("delete-well-message", "children"), Input("well-selector", "value"))
    def update_delete_well_message(well_name: str):
        return f"Delete well '{well_name}' and all attached data?"

    @app.callback(Output("modify-well-name", "value"), Input("well-selector", "value"))
    def sync_modify_well_name(well_name: str):
        return well_name

    def _register_modal_toggle(modal_key: str) -> None:
        @app.callback(
            Output(f"modal-{modal_key}", "is_open"),
            Input(f"open-{modal_key}", "n_clicks"),
            Input(f"cancel-{modal_key}", "n_clicks"),
            Input(f"confirm-{modal_key}", "n_clicks"),
            State(f"modal-{modal_key}", "is_open"),
            prevent_initial_call=True,
        )
        def _toggle_modal(open_clicks: int, cancel_clicks: int, confirm_clicks: int, is_open: bool):
            del open_clicks, cancel_clicks, confirm_clicks
            if ctx.triggered_id:
                return not is_open
            return is_open

    for modal_id in MODAL_IDS:
        _register_modal_toggle(modal_id)
