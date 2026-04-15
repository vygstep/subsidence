"""Well log panel layout — container for dynamically generated tracks."""
from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc

from ..constants import CARD_CLASS, GRAPH_CARD_STYLE


def build_well_log_col() -> dbc.Col:
    return dbc.Col(
        dbc.Card(
            dbc.CardBody(
                dcc.Graph(id="well-figure", config={"displaylogo": False}, className="mb-0")
            ),
            className=f"{CARD_CLASS} mt-3",
            style=GRAPH_CARD_STYLE,
        ),
        xs=12, md=4, lg=4, xl=4,
        className="pt-3 ps-lg-3 ms-lg-auto",
    )
