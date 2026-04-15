"""Burial panel layout — timescale + multi-well + selected-well charts."""
from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from ..constants import CARD_CLASS, GRAPH_CARD_STYLE


def _summary_panel(title: str | html.Span, timescale_id: str, burial_id: str) -> dbc.Card:
    return dbc.Card(
        dbc.CardBody(
            [
                html.Div(title, className="fw-semibold mb-1 text-center"),
                dcc.Graph(
                    id=timescale_id,
                    config={"displaylogo": False, "staticPlot": True},
                    style={"margin": "0", "padding": "0", "display": "block"},
                ),
                dcc.Graph(
                    id=burial_id,
                    config={"displaylogo": False},
                    style={"margin": "0", "padding": "0", "display": "block"},
                ),
            ],
            className="p-2",
        ),
        className=CARD_CLASS,
        style=GRAPH_CARD_STYLE,
    )


def build_burial_cols() -> dbc.Col:
    return dbc.Col(
        html.Div(
            [
                html.Div(
                    _summary_panel(
                        "Multi-Well Comparison",
                        "multi-timescale-figure",
                        "multi-burial-figure",
                    ),
                    id="multi-summary-wrap",
                    className="pt-3",
                ),
                html.Div(
                    _summary_panel(
                        html.Span(id="selected-summary-title"),
                        "selected-timescale-figure",
                        "selected-burial-figure",
                    ),
                    id="selected-summary-wrap",
                    className="pt-3",
                ),
            ],
            className="d-flex gap-3 flex-nowrap overflow-auto",
        ),
        xs=12, md=5, lg=6, xl=6,
    )
