"""Data Manager sidebar component."""
from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from ..constants import CARD_CLASS, DATASET, GRAPH_CARD_STYLE


def _action_button(label: str, button_id: str, *, color: str = "secondary") -> dbc.Button:
    return dbc.Button(label, id=button_id, color=color, outline=color != "primary", size="sm")


def build_action_toolbar() -> dbc.Card:
    return dbc.Card(
        dbc.CardBody(
            html.Div(
                [
                    _action_button("Create well", "open-create-well", color="primary"),
                    _action_button("Modify well", "open-modify-well"),
                    _action_button("Add deviation", "open-add-deviation"),
                    _action_button("Add stratigraphy", "open-add-stratigraphy"),
                    _action_button("Add log", "open-add-log"),
                    _action_button("Clear well data", "open-clear-well-data", color="warning"),
                    _action_button("Delete well", "open-delete-well", color="danger"),
                ],
                className="d-flex flex-wrap gap-2",
            )
        ),
        className=f"{CARD_CLASS} mt-1",
    )


def build_data_manager_col() -> dbc.Col:
    return dbc.Col(
        dbc.Card(
            dbc.CardBody(
                [
                    html.Div("Data Manager", className="fw-semibold mb-2"),
                    dbc.Label("Current well", className="small text-muted"),
                    dcc.Dropdown(
                        id="well-selector",
                        options=[{"label": name, "value": name} for name in DATASET],
                        value=next(iter(DATASET.keys())),
                        clearable=False,
                        className="mb-3",
                    ),
                    html.Div("Objects", className="small text-muted mb-2"),
                    dbc.ListGroup(id="object-manager-list", flush=True, className="small"),
                    html.Hr(className="my-2"),
                    html.Div("Depth viewport", className="small text-muted"),
                    html.Div(id="debug-viewport", className="small font-monospace text-secondary"),
                ]
            ),
            className=CARD_CLASS,
            style=GRAPH_CARD_STYLE,
        ),
        xs=12, md=3, lg=2, xl=2,
    )
