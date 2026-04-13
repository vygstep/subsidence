from __future__ import annotations

from dataclasses import dataclass

import plotly.graph_objects as go
from plotly.subplots import make_subplots


@dataclass(frozen=True)
class StratInterval:
    unit_name: str
    top_m: float
    base_m: float
    start_age_ma: float
    end_age_ma: float
    color_hex: str


@dataclass(frozen=True)
class CurveTrack:
    mnemonic: str
    unit: str
    depths_m: list[float]
    values: list[float]
    color: str


def build_well_figure(
    *,
    well_name: str,
    strat_intervals: list[StratInterval],
    curves: list[CurveTrack],
) -> go.Figure:
    fig = make_subplots(
        rows=1,
        cols=2,
        column_widths=[0.22, 0.78],
        shared_yaxes=True,
        horizontal_spacing=0.03,
        subplot_titles=("Stratigraphy", "Log Curves"),
    )

    for interval in strat_intervals:
        mid_depth = (interval.top_m + interval.base_m) / 2
        fig.add_trace(
            go.Bar(
                x=[1],
                y=[interval.base_m - interval.top_m],
                base=[interval.top_m],
                orientation="v",
                marker_color=interval.color_hex,
                marker_line_width=0,
                hovertemplate=(
                    "<b>%{customdata[0]}</b><br>"
                    "Top: %{customdata[1]:.1f} m<br>"
                    "Base: %{customdata[2]:.1f} m<br>"
                    "Age: %{customdata[3]:.2f} - %{customdata[4]:.2f} Ma"
                    "<extra></extra>"
                ),
                customdata=[[
                    interval.unit_name,
                    interval.top_m,
                    interval.base_m,
                    interval.start_age_ma,
                    interval.end_age_ma,
                ]],
                showlegend=False,
            ),
            row=1,
            col=1,
        )
        fig.add_annotation(
            x=1,
            y=mid_depth,
            text=interval.unit_name,
            showarrow=False,
            font={"size": 10, "color": "#222"},
            xref="x",
            yref="y",
        )

    for curve in curves:
        fig.add_trace(
            go.Scatter(
                x=curve.values,
                y=curve.depths_m,
                mode="lines",
                name=f"{curve.mnemonic} ({curve.unit})" if curve.unit else curve.mnemonic,
                line={"color": curve.color, "width": 1.8},
                hovertemplate=(
                    f"<b>{curve.mnemonic}</b><br>"
                    "Depth: %{y:.2f} m<br>"
                    "Value: %{x:.3f}"
                    f" {curve.unit if curve.unit else ''}"
                    "<extra></extra>"
                ),
            ),
            row=1,
            col=2,
        )

    fig.update_yaxes(
        title_text="Depth (m)",
        autorange="reversed",
        gridcolor="#e5e7eb",
        zeroline=False,
    )
    fig.update_xaxes(showticklabels=False, row=1, col=1)
    fig.update_xaxes(title_text="Curve value", gridcolor="#eef2f7", row=1, col=2)
    fig.update_layout(
        title=f"Well: {well_name}",
        barmode="overlay",
        margin={"l": 20, "r": 20, "t": 60, "b": 20},
        plot_bgcolor="#ffffff",
        paper_bgcolor="#ffffff",
        legend={"orientation": "h", "y": 1.05, "x": 0},
        height=820,
    )

    return fig
