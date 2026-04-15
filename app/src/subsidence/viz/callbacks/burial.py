"""Burial chart callbacks."""
from __future__ import annotations

import dash
from dash import Input, Output

from ..constants import AGE_BANDS, DATASET, SUMMARY_AGE_MAX_MA, SUMMARY_AGE_MIN_MA, SYSTEM_BANDS
from ..plotting import BurialCurve, build_burial_figure, build_timescale_figure


def register_burial_callbacks(app: dash.Dash) -> None:

    @app.callback(Output("selected-summary-title", "children"), Input("well-selector", "value"))
    def update_selected_summary_title(well_name: str):
        return well_name

    @app.callback(
        Output("selected-timescale-figure", "figure"),
        Input("well-selector", "value"),
    )
    def update_selected_timescale(_well_name: str):
        return build_timescale_figure(system_bands=SYSTEM_BANDS, age_bands=AGE_BANDS)

    @app.callback(
        Output("multi-timescale-figure", "figure"),
        Input("well-selector", "value"),
    )
    def update_multi_timescale(_well_name: str):
        return build_timescale_figure(system_bands=SYSTEM_BANDS, age_bands=AGE_BANDS)

    @app.callback(
        Output("burial-selected", "figure"),
        Input("well-selector", "value"),
    )
    def update_selected_burial(well_name: str):
        return build_burial_figure(
            curves=DATASET[well_name]["burial_curves"],
            show_axes=True,
            age_min_ma=SUMMARY_AGE_MIN_MA,
            age_max_ma=SUMMARY_AGE_MAX_MA,
        )

    @app.callback(
        Output("burial-multi", "figure"),
        Input("well-selector", "value"),
    )
    def update_multi_burial(_well_name: str):
        palette = ["#264653", "#2a9d8f", "#e76f51", "#457b9d"]
        curves = [
            BurialCurve(
                label=name,
                ages_ma=payload["burial_curves"][0].ages_ma,
                depths_m=payload["burial_curves"][0].depths_m,
                color=palette[i % len(palette)],
            )
            for i, (name, payload) in enumerate(DATASET.items())
        ]
        return build_burial_figure(
            curves=curves,
            show_axes=True,
            age_min_ma=SUMMARY_AGE_MIN_MA,
            age_max_ma=SUMMARY_AGE_MAX_MA,
        )
