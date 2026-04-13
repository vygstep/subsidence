import dash
import dash_bootstrap_components as dbc
from dash import html

app = dash.Dash(
    __name__,
    external_stylesheets=[dbc.themes.BOOTSTRAP],
    title="SUBSIDENCE",
)

app.layout = dbc.Container(
    [
        dbc.Row(
            dbc.Col(
                html.H2("SUBSIDENCE — Well Log Viewer"),
                className="py-3",
            )
        ),
        dbc.Row(
            [
                # Left panel: stratigraphic column
                dbc.Col(
                    dbc.Card(
                        dbc.CardBody(
                            html.P(
                                "Stratigraphic column will appear here.",
                                className="text-muted",
                            )
                        ),
                        className="h-100",
                    ),
                    width=3,
                ),
                # Right panel: well log curves
                dbc.Col(
                    dbc.Card(
                        dbc.CardBody(
                            html.P(
                                "Well log curves will appear here.",
                                className="text-muted",
                            )
                        ),
                        className="h-100",
                    ),
                    width=9,
                ),
            ],
            style={"minHeight": "80vh"},
        ),
    ],
    fluid=True,
)

if __name__ == "__main__":
    app.run(debug=True)
