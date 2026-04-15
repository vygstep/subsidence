"""Dash application entry point."""
import dash
import dash_bootstrap_components as dbc

from .callbacks import register_all_callbacks
from .layout import build_layout

app = dash.Dash(
    __name__,
    external_stylesheets=[dbc.themes.BOOTSTRAP],
    title="SUBSIDENCE",
    suppress_callback_exceptions=True,
)

app.layout = build_layout()
register_all_callbacks(app)


if __name__ == "__main__":
    app.run(debug=True)
