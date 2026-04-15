"""Well log figure callback."""
from __future__ import annotations

import dash
from dash import Input, Output

from ..constants import DATASET
from ..plotting import build_well_figure


def register_well_log_callbacks(app: dash.Dash) -> None:

    @app.callback(Output("well-figure", "figure"), Input("well-selector", "value"))
    def update_well_figure(well_name: str):
        payload = DATASET[well_name]
        return build_well_figure(
            well_name=well_name,
            strat_intervals=payload["strat"],
            lithology_intervals=payload["lithology"],
            curves=payload["curves"],
        )
