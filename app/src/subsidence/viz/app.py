import dash
import dash_bootstrap_components as dbc
from dash import Input
from dash import Output
from dash import dcc
from dash import html

from .plotting import CurveTrack
from .plotting import StratInterval
from .plotting import build_well_figure


def _demo_data() -> dict[str, dict[str, list]]:
    return {
        "WELL-A": {
            "strat": [
                StratInterval("Neogene", 1000, 1200, 2.58, 23.03, "#f2c14e"),
                StratInterval("Paleogene", 1200, 1500, 23.03, 66.0, "#e88b4a"),
                StratInterval("Cretaceous", 1500, 1900, 66.0, 145.0, "#99d17b"),
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
            "strat": [
                StratInterval("Quaternary", 800, 950, 0.0, 2.58, "#f8e08e"),
                StratInterval("Neogene", 950, 1250, 2.58, 23.03, "#e8b949"),
                StratInterval("Paleogene", 1250, 1650, 23.03, 66.0, "#cf7a3f"),
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
)

app.layout = dbc.Container(
    [
        dbc.Row(dbc.Col(html.H2("SUBSIDENCE — Well Log Viewer"), className="py-3")),
        dbc.Row(
            [
                dbc.Col(
                    [
                        html.Label("Well", className="fw-semibold"),
                        dcc.Dropdown(
                            id="well-selector",
                            options=[{"label": name, "value": name} for name in DATASET],
                            value=next(iter(DATASET.keys())),
                            clearable=False,
                        ),
                        html.Small(
                            "Stratigraphic column and curves are synchronized by depth.",
                            className="text-muted d-block mt-3",
                        ),
                    ],
                    width=3,
                ),
                dbc.Col(dcc.Graph(id="well-figure", config={"displaylogo": False}), width=9),
            ]
        ),
    ],
    fluid=True,
)


@app.callback(Output("well-figure", "figure"), Input("well-selector", "value"))
def update_well_figure(well_name: str):
    payload = DATASET[well_name]
    return build_well_figure(
        well_name=well_name,
        strat_intervals=payload["strat"],
        curves=payload["curves"],
    )

if __name__ == "__main__":
    app.run(debug=True)
