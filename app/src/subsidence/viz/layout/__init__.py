"""Layout assembly - builds the full dbc.Container for the app."""
from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from .burial_panel import build_burial_cols
from .modals import (
    build_add_deviation_modal,
    build_add_log_modal,
    build_add_stratigraphy_modal,
    build_clear_well_modal,
    build_create_well_modal,
    build_delete_well_modal,
    build_modify_well_modal,
)
from .sidebar import build_action_toolbar, build_data_manager_col
from .well_log_panel import build_well_log_col


def _one_d_panel() -> html.Div:
    return html.Div(
        dbc.Row(
            [
                build_data_manager_col(),
                build_well_log_col(),
                build_burial_cols(),
            ],
            className="g-3 mt-3",
        )
    )


def _two_d_panel() -> dbc.Card:
    return dbc.Card(
        dbc.CardBody(
            [
                html.H5("2D Modelling", className="mb-3"),
                html.P("This area is reserved for the future 2D modelling workflow.", className="text-muted mb-1"),
                html.P("No 2D viewer is implemented yet.", className="text-muted mb-0"),
            ]
        ),
        className="border-0 shadow-sm mt-3",
    )


def _stores() -> list:
    return [
        dcc.Store(id="selected-well", data=None),
        # r0/r1 map directly to Plotly yaxis.range[0]/[1]:
        # r0 = bottom of chart (deeper depth, larger value), r1 = top (shallower, smaller)
        # Default matches burial chart range=[2500, 0]: 0m at top, 2500m at bottom.
        dcc.Store(id="depth-viewport", data={"r0": 2500.0, "r1": 0.0}),
        dcc.Store(id="sync-enabled", data=False),
        dcc.Store(id="picks-store", data={}),
        dcc.Store(id="pick-mode", data=False),
        dcc.Store(id="track-x-ranges", data={}),
        dcc.Store(id="track-graph-ids", data=[]),
        dcc.Store(id="sync-dummy", data=None),
    ]


def build_layout() -> dbc.Container:
    return dbc.Container(
        _stores() + [
            dbc.Row(
                dbc.Col(
                    [
                        html.H2("SUBSIDENCE", className="mb-2"),
                        dbc.Tabs(
                            id="modelling-tabs",
                            active_tab="tab-1d",
                            className="mb-1",
                            children=[
                                dbc.Tab(label="1D Modelling", tab_id="tab-1d"),
                                dbc.Tab(label="2D Modelling", tab_id="tab-2d"),
                            ],
                        ),
                        build_action_toolbar(),
                    ],
                    className="pt-3",
                )
            ),
            html.Div(id="one-d-wrapper", children=_one_d_panel()),
            html.Div(id="two-d-wrapper", children=_two_d_panel(), style={"display": "none"}),
            build_create_well_modal(),
            build_modify_well_modal(),
            build_add_deviation_modal(),
            build_add_stratigraphy_modal(),
            build_add_log_modal(),
            build_clear_well_modal(),
            build_delete_well_modal(),
        ],
        fluid=True,
        className="pb-4",
    )
