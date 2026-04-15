"""Well log panel layout - container for independent well tracks."""
from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from ..constants import CARD_CLASS, GRAPH_CARD_STYLE, WELL_TRACK_IDS

_TRACK_LAYOUT = [
    ("Depth", WELL_TRACK_IDS[3], "3rem", True),
    ("Strat", WELL_TRACK_IDS[0], "5rem", False),
    ("Litho", WELL_TRACK_IDS[1], "2.5rem", False),
    ("", WELL_TRACK_IDS[2], "6rem", False),
]


def _track_panel(label: str, graph_id: str, basis: str, scroll_zoom: bool) -> html.Div:
    return html.Div(
        [
            html.Div(label or " ", className="small text-muted text-center mb-1", style={"minHeight": "1rem", "lineHeight": "1rem"}),
            dcc.Graph(
                id=graph_id,
                config={"displaylogo": False, "scrollZoom": scroll_zoom},
                className="mb-0",
                style={"height": "392px"},
            ),
        ],
        style={"flex": f"0 0 {basis}", "minWidth": basis, "margin": "0", "padding": "0"},
    )


def build_well_log_col() -> dbc.Col:
    return dbc.Col(
        dbc.Card(
            dbc.CardBody(
                html.Div(
                    [_track_panel(label, graph_id, basis, scroll_zoom) for label, graph_id, basis, scroll_zoom in _TRACK_LAYOUT],
                    className="d-flex flex-nowrap align-items-stretch overflow-auto",
                    style={"gap": "0", "columnGap": "0", "rowGap": "0"},
                ),
                className="p-2",
            ),
            className=f"{CARD_CLASS} mt-3",
            style=GRAPH_CARD_STYLE,
        ),
        xs=12,
        md=4,
        lg=4,
        xl=4,
        className="pt-3 ps-lg-3 ms-lg-auto",
    )
