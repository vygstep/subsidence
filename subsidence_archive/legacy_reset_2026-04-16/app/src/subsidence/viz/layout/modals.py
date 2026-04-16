"""Modal dialog builders."""
from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from ..constants import CLEAR_OPTIONS


def build_create_well_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Create well")),
            dbc.ModalBody(
                [
                    dbc.Label("Input mode", className="fw-semibold"),
                    dbc.RadioItems(
                        id="create-well-mode",
                        options=[
                            {"label": "Manual input", "value": "manual"},
                            {"label": "Load from file", "value": "file"},
                        ],
                        value="manual",
                        className="mb-3",
                    ),
                    html.Div(
                        id="create-well-manual-fields",
                        children=[
                            dbc.Row(
                                [
                                    dbc.Col([dbc.Label("Well name"), dbc.Input(placeholder="WELL-001")], md=6),
                                    dbc.Col([dbc.Label("CRS"), dbc.Input(placeholder="unset")], md=6),
                                ],
                                className="g-3",
                            ),
                            dbc.Row(
                                [
                                    dbc.Col([dbc.Label("KB elevation"), dbc.Input(type="number", value=10)], md=6),
                                    dbc.Col([dbc.Label("GL elevation"), dbc.Input(type="number", value=10)], md=6),
                                    dbc.Col([dbc.Label("TD MD"), dbc.Input(type="number", value=1000)], md=6),
                                    dbc.Col([dbc.Label("TD TVD"), dbc.Input(type="number", value=1000)], md=6),
                                    dbc.Col([dbc.Label("X"), dbc.Input(type="number", value=0)], md=6),
                                    dbc.Col([dbc.Label("Y"), dbc.Input(type="number", value=0)], md=6),
                                ],
                                className="g-3 mt-1",
                            ),
                        ],
                    ),
                    html.Div(
                        id="create-well-file-fields",
                        style={"display": "none"},
                        children=[
                            dbc.Label("Load well definition from file", className="fw-semibold"),
                            dcc.Upload(
                                id="create-well-upload",
                                children=dbc.Card(
                                    dbc.CardBody("Drag and drop a file here or click to select one.", className="text-muted")
                                ),
                                className="border border-2 border-secondary-subtle",
                            ),
                        ],
                    ),
                ]
            ),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-create-well", color="secondary", outline=True),
                    dbc.Button("Save", id="confirm-create-well", color="primary"),
                ]
            ),
        ],
        id="modal-create-well",
        size="lg",
        is_open=False,
    )


def build_modify_well_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Modify well")),
            dbc.ModalBody(
                dbc.Row(
                    [
                        dbc.Col([dbc.Label("Well name"), dbc.Input(id="modify-well-name")], md=6),
                        dbc.Col([dbc.Label("CRS"), dbc.Input(placeholder="unset")], md=6),
                        dbc.Col([dbc.Label("KB elevation"), dbc.Input(type="number")], md=6),
                        dbc.Col([dbc.Label("GL elevation"), dbc.Input(type="number")], md=6),
                        dbc.Col([dbc.Label("TD MD"), dbc.Input(type="number")], md=6),
                        dbc.Col([dbc.Label("TD TVD"), dbc.Input(type="number")], md=6),
                        dbc.Col([dbc.Label("X"), dbc.Input(type="number")], md=6),
                        dbc.Col([dbc.Label("Y"), dbc.Input(type="number")], md=6),
                    ],
                    className="g-3",
                )
            ),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-modify-well", color="secondary", outline=True),
                    dbc.Button("Save", id="confirm-modify-well", color="primary"),
                ]
            ),
        ],
        id="modal-modify-well",
        size="lg",
        is_open=False,
    )


def build_add_deviation_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Add deviation")),
            dbc.ModalBody(
                [
                    dbc.Row(
                        [
                            dbc.Col(
                                [
                                    dbc.Label("Depth reference"),
                                    dbc.Select(
                                        options=[
                                            {"label": "MD", "value": "MD"},
                                            {"label": "TVD", "value": "TVD"},
                                            {"label": "TVDSS", "value": "TVDSS"},
                                        ],
                                        value="MD",
                                    ),
                                ],
                                md=6,
                            ),
                            dbc.Col(
                                [
                                    dbc.Label("Format"),
                                    dbc.Select(
                                        options=[
                                            {"label": "MD + INCL + AZIM", "value": "INCL_AZIM"},
                                            {"label": "MD + X + Y", "value": "X_Y"},
                                            {"label": "MD + DX + DY", "value": "DX_DY"},
                                        ],
                                        value="INCL_AZIM",
                                    ),
                                ],
                                md=6,
                            ),
                        ],
                        className="g-3",
                    ),
                    html.Div(className="mt-3"),
                    dcc.Upload(
                        children=dbc.Card(
                            dbc.CardBody("Drag and drop a deviation file here or click to select one.", className="text-muted")
                        ),
                        className="border border-2 border-secondary-subtle",
                    ),
                ]
            ),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-add-deviation", color="secondary", outline=True),
                    dbc.Button("Add", id="confirm-add-deviation", color="primary"),
                ]
            ),
        ],
        id="modal-add-deviation",
        size="lg",
        is_open=False,
    )


def build_add_stratigraphy_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Add stratigraphy")),
            dbc.ModalBody(
                [
                    dbc.Row(
                        [
                            dbc.Col([dbc.Label("Units CSV"), dbc.Input(placeholder="units.csv")], md=6),
                            dbc.Col([dbc.Label("Ranks CSV"), dbc.Input(placeholder="ranks.csv")], md=6),
                            dbc.Col([dbc.Label("Tops CSV"), dbc.Input(placeholder="tops.csv")], md=6),
                            dbc.Col([dbc.Label("Unconformities CSV"), dbc.Input(placeholder="unconformities.csv")], md=6),
                        ],
                        className="g-3",
                    ),
                    html.Div(className="mt-3"),
                    dcc.Upload(
                        children=dbc.Card(
                            dbc.CardBody("Drag and drop stratigraphy-related files here or click to select them.", className="text-muted")
                        ),
                        multiple=True,
                        className="border border-2 border-secondary-subtle",
                    ),
                ]
            ),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-add-stratigraphy", color="secondary", outline=True),
                    dbc.Button("Add", id="confirm-add-stratigraphy", color="primary"),
                ]
            ),
        ],
        id="modal-add-stratigraphy",
        size="lg",
        is_open=False,
    )


def build_add_log_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Add log")),
            dbc.ModalBody(
                [
                    dbc.Row(
                        [
                            dbc.Col(
                                [
                                    dbc.Label("File type"),
                                    dbc.Select(
                                        options=[
                                            {"label": "LAS", "value": "las"},
                                            {"label": "CSV", "value": "csv"},
                                        ],
                                        value="las",
                                    ),
                                ],
                                md=6,
                            ),
                            dbc.Col(
                                [
                                    dbc.Label("Depth unit"),
                                    dbc.Select(
                                        options=[
                                            {"label": "m", "value": "m"},
                                            {"label": "ft", "value": "ft"},
                                        ],
                                        value="m",
                                    ),
                                ],
                                md=6,
                            ),
                        ],
                        className="g-3",
                    ),
                    html.Div(className="mt-3"),
                    dcc.Upload(
                        children=dbc.Card(
                            dbc.CardBody("Drag and drop a LAS or CSV log file here or click to select one.", className="text-muted")
                        ),
                        className="border border-2 border-secondary-subtle",
                    ),
                ]
            ),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-add-log", color="secondary", outline=True),
                    dbc.Button("Add", id="confirm-add-log", color="primary"),
                ]
            ),
        ],
        id="modal-add-log",
        size="lg",
        is_open=False,
    )


def build_clear_well_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Clear well data")),
            dbc.ModalBody(
                [
                    dbc.Button(
                        "Select all",
                        id="clear-well-select-all",
                        color="secondary",
                        outline=True,
                        size="sm",
                        className="mb-3",
                    ),
                    dbc.Checklist(
                        id="clear-well-data-options",
                        options=CLEAR_OPTIONS,
                        value=[],
                        className="d-grid gap-2",
                    ),
                ]
            ),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-clear-well-data", color="secondary", outline=True),
                    dbc.Button("Clear selected", id="confirm-clear-well-data", color="warning"),
                ]
            ),
        ],
        id="modal-clear-well-data",
        is_open=False,
    )


def build_delete_well_modal() -> dbc.Modal:
    return dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Delete well")),
            dbc.ModalBody(id="delete-well-message"),
            dbc.ModalFooter(
                [
                    dbc.Button("Cancel", id="cancel-delete-well", color="secondary", outline=True),
                    dbc.Button("Delete well", id="confirm-delete-well", color="danger"),
                ]
            ),
        ],
        id="modal-delete-well",
        is_open=False,
    )
