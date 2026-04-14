import dash
import dash_bootstrap_components as dbc
from dash import Input
from dash import Output
from dash import State
from dash import ctx
from dash import dcc
from dash import html

from .plotting import BurialCurve
from .plotting import CurveTrack
from .plotting import LithologyInterval
from .plotting import StratInterval
from .plotting import TimeScaleBand
from .plotting import build_burial_figure
from .plotting import build_timescale_figure
from .plotting import build_well_figure


CLEAR_OPTIONS = [
    {"label": "Deviation survey", "value": "deviation"},
    {"label": "Stratigraphy", "value": "stratigraphy"},
    {"label": "Lithology", "value": "lithology"},
    {"label": "Logs", "value": "logs"},
    {"label": "Tops and unconformities", "value": "tops"},
]


MODAL_IDS = [
    "create-well",
    "modify-well",
    "add-deviation",
    "add-stratigraphy",
    "add-log",
    "clear-well-data",
    "delete-well",
]


CARD_CLASS = "border-0 shadow-sm"
GRAPH_CARD_STYLE = {"border": "1px solid #cbd5e1", "borderRadius": "0.6rem", "width": "100%"}


SYSTEM_BANDS = [
    TimeScaleBand("Cenozoic", 0.0, 66.0, "#f3e36f"),
    TimeScaleBand("Mesozoic", 66.0, 252.0, "#72c7d6"),
]


AGE_BANDS = [
    TimeScaleBand("Q", 0.0, 2.58, "#fff3a3"),
    TimeScaleBand("Ng", 2.58, 23.03, "#ffd166"),
    TimeScaleBand("Pg", 23.03, 66.0, "#e9a03b"),
    TimeScaleBand("K", 66.0, 145.0, "#8fd17f"),
    TimeScaleBand("J", 145.0, 201.3, "#34b3e4"),
    TimeScaleBand("Tr", 201.3, 252.0, "#9b6fc0"),
]


SUMMARY_AGE_MIN_MA = min([band.younger_age_ma for band in SYSTEM_BANDS + AGE_BANDS])
SUMMARY_AGE_MAX_MA = max([band.older_age_ma for band in SYSTEM_BANDS + AGE_BANDS])

def _demo_data() -> dict[str, dict[str, list]]:
    return {
        "WELL-A": {
            "burial_curves": [
                BurialCurve(
                    "Present-day burial",
                    [160, 120, 80, 40, 0],
                    [700, 980, 1280, 1650, 1900],
                    "#264653",
                ),
                BurialCurve(
                    "Compacted burial",
                    [160, 120, 80, 40, 0],
                    [620, 900, 1180, 1520, 1770],
                    "#2a9d8f",
                    dash="dash",
                ),
                BurialCurve(
                    "Decompacted burial",
                    [160, 120, 80, 40, 0],
                    [520, 790, 1050, 1380, 1600],
                    "#e76f51",
                    dash="dot",
                ),
            ],
            "strat": [
                StratInterval("Neogene", 1000, 1200, 2.58, 23.03, "#f2c14e"),
                StratInterval("Paleogene", 1200, 1500, 23.03, 66.0, "#e88b4a"),
                StratInterval("Cretaceous", 1500, 1900, 66.0, 145.0, "#99d17b"),
            ],
            "lithology": [
                LithologyInterval("Sand", 1000, 1120, "#d8b36a"),
                LithologyInterval("Shale", 1120, 1380, "#8d99ae"),
                LithologyInterval("Lmst", 1380, 1620, "#bfc0c0"),
                LithologyInterval("Sand", 1620, 1900, "#d8b36a"),
            ],
            "curves": [
                CurveTrack(
                    "GR",
                    "gAPI",
                    [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
                    [65, 70, 82, 78, 73, 88, 96, 90, 84, 79],
                    "#2a9d8f",
                ),
                CurveTrack(
                    "DT",
                    "us/ft",
                    [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
                    [82, 85, 87, 91, 94, 96, 93, 89, 86, 84],
                    "#e76f51",
                ),
            ],
        },
        "WELL-B": {
            "burial_curves": [
                BurialCurve(
                    "Present-day burial",
                    [160, 120, 80, 40, 0],
                    [520, 760, 1040, 1360, 1600],
                    "#264653",
                ),
                BurialCurve(
                    "Compacted burial",
                    [160, 120, 80, 40, 0],
                    [470, 700, 970, 1270, 1490],
                    "#2a9d8f",
                    dash="dash",
                ),
                BurialCurve(
                    "Decompacted burial",
                    [160, 120, 80, 40, 0],
                    [390, 630, 890, 1150, 1360],
                    "#e76f51",
                    dash="dot",
                ),
            ],
            "strat": [
                StratInterval("Quaternary", 800, 940, 0.0, 2.58, "#f8e08e"),
                StratInterval("Neogene", 940, 1230, 2.58, 23.03, "#e8b949"),
                StratInterval("Paleogene", 1230, 1600, 23.03, 66.0, "#cf7a3f"),
            ],
            "lithology": [
                LithologyInterval("Clay", 800, 980, "#8d99ae"),
                LithologyInterval("Sand", 980, 1260, "#d8b36a"),
                LithologyInterval("Lmst", 1260, 1450, "#bfc0c0"),
                LithologyInterval("Shale", 1450, 1600, "#7f8c8d"),
            ],
            "curves": [
                CurveTrack(
                    "GR",
                    "gAPI",
                    [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
                    [55, 61, 68, 75, 81, 79, 74, 69, 66],
                    "#2a9d8f",
                ),
                CurveTrack(
                    "RHOB",
                    "g/cm3",
                    [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
                    [2.15, 2.18, 2.21, 2.24, 2.28, 2.31, 2.29, 2.26, 2.23],
                    "#264653",
                ),
            ],
        },
    }


DATASET = _demo_data()

app = dash.Dash(
    __name__,
    external_stylesheets=[dbc.themes.BOOTSTRAP],
    title="SUBSIDENCE",
    suppress_callback_exceptions=True,
)


def _action_button(label: str, button_id: str, *, color: str = "secondary") -> dbc.Button:
    return dbc.Button(label, id=button_id, color=color, outline=color != "primary", size="sm")


def _build_create_well_modal() -> dbc.Modal:
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
                                    dbc.CardBody(
                                        "Drag and drop a file here or click to select one.",
                                        className="text-muted",
                                    )
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


def _build_modify_well_modal() -> dbc.Modal:
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


def _build_add_deviation_modal() -> dbc.Modal:
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
                            dbc.CardBody(
                                "Drag and drop a deviation file here or click to select one.",
                                className="text-muted",
                            )
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


def _build_add_stratigraphy_modal() -> dbc.Modal:
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
                            dbc.CardBody(
                                "Drag and drop stratigraphy-related files here or click to select them.",
                                className="text-muted",
                            )
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


def _build_add_log_modal() -> dbc.Modal:
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
                            dbc.CardBody(
                                "Drag and drop a LAS or CSV log file here or click to select one.",
                                className="text-muted",
                            )
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


def _build_clear_well_modal() -> dbc.Modal:
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


def _build_delete_well_modal() -> dbc.Modal:
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


def _build_action_toolbar() -> dbc.Card:
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


def _build_summary_panel(title: str, timescale_id: str, burial_id: str) -> dbc.Card:
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

def _build_object_manager() -> dbc.Card:
    return dbc.Card(
        dbc.CardBody(
            [
                html.Div("Object Manager", className="fw-semibold mb-2"),
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
                html.Hr(className="my-3"),
                html.Div("Left Summary Test Settings", className="small text-muted mb-2"),
                dbc.Label("Double stratigraphy start", className="small mb-1"),
                dbc.Input(id="multi-timescale-start", type="number", min=0, max=0.95, step=0.01, value=0.00, size="sm", className="mb-2"),
                dbc.Label("Double stratigraphy length", className="small mb-1"),
                dbc.Input(id="multi-timescale-length", type="number", min=0.05, max=1.0, step=0.01, value=1.00, size="sm", className="mb-2"),
                dbc.Label("Lower box left-axis position", className="small mb-1"),
                dbc.Input(id="multi-burial-axis-left", type="number", min=0, max=0.95, step=0.01, value=0.05, size="sm", className="mb-2"),
                dbc.Label("Lower box length", className="small mb-1"),
                dbc.Input(id="multi-burial-width", type="number", min=0.05, max=1.0, step=0.01, value=0.91, size="sm", className="mb-2"),
                html.Small(
                    "Values are normalized fractions in the 0..1 range.",
                    className="text-muted d-block mt-2",
                ),
            ]
        ),
        className=CARD_CLASS,
        style=GRAPH_CARD_STYLE,
    )

def _one_d_panel() -> html.Div:
    return html.Div(
        [
            dbc.Row(
                [
                    dbc.Col(_build_object_manager(), xs=12, md=3, lg=2, xl=2),
                    dbc.Col(
                        html.Div(
                            [
                                html.Div(
                                    _build_summary_panel(
                                        "Multi-Well Comparison",
                                        "multi-timescale-figure",
                                        "multi-burial-figure",
                                    ),
                                    id="multi-summary-wrap",
                                    className="pt-3",
                                ),
                                html.Div(
                                    _build_summary_panel(
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
                        xs=12,
                        md=5,
                        lg=6,
                        xl=6,
                    ),
                    dbc.Col(
                        dbc.Card(
                            dbc.CardBody(
                                dcc.Graph(id="well-figure", config={"displaylogo": False}, className="mb-0")
                            ),
                            className=f"{CARD_CLASS} mt-3",
                            style=GRAPH_CARD_STYLE,
                        ),
                        xs=12,
                        md=4,
                        lg=4,
                        xl=4,
                        className="pt-3 ps-lg-3 ms-lg-auto",
                    ),
                ],
                className="g-3 mt-3",
            ),
        ]
    )

def _two_d_panel() -> dbc.Card:
    return dbc.Card(
        dbc.CardBody(
            [
                html.H5("2D Modelling", className="mb-3"),
                html.P(
                    "This area is reserved for the future 2D modelling workflow.",
                    className="text-muted mb-1",
                ),
                html.P("No 2D viewer is implemented yet.", className="text-muted mb-0"),
            ]
        ),
        className=f"{CARD_CLASS} mt-3",
    )


app.layout = dbc.Container(
    [
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
                    _build_action_toolbar(),
                ],
                className="pt-3",
            )
        ),
        html.Div(id="one-d-wrapper", children=_one_d_panel()),
        html.Div(id="two-d-wrapper", children=_two_d_panel(), style={"display": "none"}),
        _build_create_well_modal(),
        _build_modify_well_modal(),
        _build_add_deviation_modal(),
        _build_add_stratigraphy_modal(),
        _build_add_log_modal(),
        _build_clear_well_modal(),
        _build_delete_well_modal(),
    ],
    fluid=True,
    className="pb-4",
)


@app.callback(Output("selected-summary-title", "children"), Input("well-selector", "value"))
def update_selected_summary_title(well_name: str):
    return well_name


@app.callback(
    Output("selected-timescale-figure", "figure"),
    Input("well-selector", "value"),
    Input("multi-timescale-start", "value"),
    Input("multi-timescale-length", "value"),
)
def update_selected_timescale(_well_name: str, strat_start: float, strat_length: float):
    return build_timescale_figure(
        system_bands=SYSTEM_BANDS,
        age_bands=AGE_BANDS,
        strat_start=strat_start if strat_start is not None else 0.0,
        strat_length=strat_length if strat_length is not None else 1.0,
    )


@app.callback(
    Output("multi-timescale-figure", "figure"),
    Input("well-selector", "value"),
    Input("multi-timescale-start", "value"),
    Input("multi-timescale-length", "value"),
)
def update_multi_timescale(_well_name: str, strat_start: float, strat_length: float):
    return build_timescale_figure(
        system_bands=SYSTEM_BANDS,
        age_bands=AGE_BANDS,
        strat_start=strat_start if strat_start is not None else 0.0,
        strat_length=strat_length if strat_length is not None else 1.0,
    )


@app.callback(
    Output("selected-burial-figure", "figure"),
    Input("well-selector", "value"),
    Input("multi-burial-axis-left", "value"),
    Input("multi-burial-width", "value"),
)
def update_selected_burial(well_name: str, axis_left: float, rectangle_length: float):
    return build_burial_figure(
        curves=DATASET[well_name]["burial_curves"],
        left_axis_position=axis_left if axis_left is not None else 0.0,
        rectangle_length=rectangle_length if rectangle_length is not None else 1.0,
        show_axes=True,
        age_min_ma=SUMMARY_AGE_MIN_MA,
        age_max_ma=SUMMARY_AGE_MAX_MA,
    )


@app.callback(
    Output("multi-burial-figure", "figure"),
    Input("well-selector", "value"),
    Input("multi-burial-axis-left", "value"),
    Input("multi-burial-width", "value"),
)
def update_multi_burial(_well_name: str, axis_left: float, rectangle_length: float):
    curves = []
    palette = ["#264653", "#2a9d8f", "#e76f51", "#457b9d"]
    for index, (name, payload) in enumerate(DATASET.items()):
        master_curve = payload["burial_curves"][0]
        curves.append(
            BurialCurve(
                label=name,
                ages_ma=master_curve.ages_ma,
                depths_m=master_curve.depths_m,
                color=palette[index % len(palette)],
            )
        )
    return build_burial_figure(
        curves=curves,
        left_axis_position=axis_left if axis_left is not None else 0.0,
        rectangle_length=rectangle_length if rectangle_length is not None else 1.0,
        show_axes=True,
        age_min_ma=SUMMARY_AGE_MIN_MA,
        age_max_ma=SUMMARY_AGE_MAX_MA,
    )


@app.callback(Output("well-figure", "figure"), Input("well-selector", "value"))
def update_well_figure(well_name: str):
    payload = DATASET[well_name]
    return build_well_figure(
        well_name=well_name,
        strat_intervals=payload["strat"],
        lithology_intervals=payload["lithology"],
        curves=payload["curves"],
    )


@app.callback(Output("object-manager-list", "children"), Input("well-selector", "value"))
def update_object_manager(well_name: str):
    payload = DATASET[well_name]
    items = [
        dbc.ListGroupItem(f"Well: {well_name}"),
        dbc.ListGroupItem(f"Burial curves: {len(payload['burial_curves'])}"),
        dbc.ListGroupItem(f"Stratigraphy intervals: {len(payload['strat'])}"),
        dbc.ListGroupItem(f"Lithology intervals: {len(payload['lithology'])}"),
        dbc.ListGroupItem(f"Log tracks: {len(payload['curves'])}"),
        dbc.ListGroupItem("Deviation survey: not loaded"),
    ]
    return items


@app.callback(
    Output("multi-summary-wrap", "style"),
    Output("selected-summary-wrap", "style"),
    Input("multi-timescale-start", "value"),
    Input("multi-timescale-length", "value"),
    Input("multi-burial-axis-left", "value"),
    Input("multi-burial-width", "value"),
)
def sync_summary_card_sizes(strat_start: float, strat_length: float, axis_left: float, rectangle_length: float):
    strat_extent = (strat_start if strat_start is not None else 0.0) + (strat_length if strat_length is not None else 1.0)
    burial_extent = (axis_left if axis_left is not None else 0.0) + (rectangle_length if rectangle_length is not None else 1.0)
    occupied = max(1.0, strat_extent, burial_extent)
    width_px = int(320 + 220 * occupied)
    style = {
        "width": f"{width_px}px",
        "minWidth": f"{width_px}px",
        "flex": f"0 0 {width_px}px",
    }
    return style, style

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


for _modal_id in MODAL_IDS:
    _register_modal_toggle(_modal_id)


if __name__ == "__main__":
    app.run(debug=True)
