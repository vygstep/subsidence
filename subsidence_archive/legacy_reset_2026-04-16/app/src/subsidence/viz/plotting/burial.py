"""Plotly figure builders for burial history charts."""
from __future__ import annotations

from dataclasses import dataclass

import plotly.graph_objects as go


@dataclass(frozen=True)
class BurialCurve:
    label: str
    ages_ma: list[float]
    depths_m: list[float]
    color: str
    dash: str = "solid"


@dataclass(frozen=True)
class TimeScaleBand:
    label: str
    younger_age_ma: float
    older_age_ma: float
    color_hex: str


def _normalized_domain(start: float, length: float) -> tuple[float, float]:
    safe_start = max(0.0, min(float(start), 0.95))
    safe_length = max(0.05, min(float(length), 1.0))
    safe_end = min(1.0, safe_start + safe_length)
    if safe_end - safe_start < 0.05:
        safe_start = max(0.0, safe_end - 0.05)
    return safe_start, safe_end


def build_timescale_figure(
    *,
    system_bands: list[TimeScaleBand],
    age_bands: list[TimeScaleBand],
    strat_start: float = 0.0,
    strat_length: float = 1.0,
) -> go.Figure:
    fig = go.Figure()
    x_domain = _normalized_domain(strat_start, strat_length)
    min_age = min(band.younger_age_ma for band in system_bands + age_bands)
    max_age = max(band.older_age_ma for band in system_bands + age_bands)

    for band in system_bands:
        fig.add_trace(
            go.Bar(
                x=[band.older_age_ma - band.younger_age_ma],
                y=[1.5],
                base=[band.younger_age_ma],
                orientation="h",
                width=1.0,
                marker={"color": band.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                text=[band.label],
                textposition="inside",
                insidetextanchor="middle",
                hovertemplate=(
                    f"<b>{band.label}</b><br>"
                    "Age: %{base:.2f} - %{x:.2f} Ma"
                    "<extra></extra>"
                ),
                showlegend=False,
            )
        )

    for band in age_bands:
        fig.add_trace(
            go.Bar(
                x=[band.older_age_ma - band.younger_age_ma],
                y=[0.5],
                base=[band.younger_age_ma],
                orientation="h",
                width=1.0,
                marker={"color": band.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                text=[band.label],
                textposition="inside",
                insidetextanchor="middle",
                hovertemplate=(
                    f"<b>{band.label}</b><br>"
                    "Age: %{base:.2f} - %{x:.2f} Ma"
                    "<extra></extra>"
                ),
                showlegend=False,
            )
        )

    fig.update_xaxes(
        domain=list(x_domain),
        autorange="reversed",
        range=[max_age, min_age],
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        fixedrange=True,
    )
    fig.update_yaxes(
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        range=[0, 2],
        fixedrange=True,
    )
    fig.update_layout(
        barmode="overlay",
        bargap=0,
        bargroupgap=0,
        height=80,
        margin={"l": 0, "r": 0, "t": 0, "b": 0},
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        font={"size": 10, "color": "#24323f"},
    )
    return fig


def build_burial_figure(
    *,
    curves: list[BurialCurve],
    height: int = 260,
    left_axis_position: float = 0.0,
    rectangle_length: float = 1.0,
    show_axes: bool = True,
    age_min_ma: float = 0.0,
    age_max_ma: float = 252.0,
) -> go.Figure:
    fig = go.Figure()
    x_domain = _normalized_domain(left_axis_position, rectangle_length)

    for curve in curves:
        fig.add_trace(
            go.Scatter(
                x=curve.ages_ma,
                y=curve.depths_m,
                mode="lines",
                name=curve.label,
                line={"color": curve.color, "width": 2.2, "dash": curve.dash},
                hovertemplate=(
                    f"<b>{curve.label}</b><br>"
                    "Age: %{x:.1f} Ma<br>"
                    "Depth: %{y:.1f} m"
                    "<extra></extra>"
                ),
            )
        )

    age_ticks = [age_min_ma, 50, 100, 150, 200, age_max_ma]
    age_ticks = sorted({round(float(v), 2) for v in age_ticks if age_min_ma <= float(v) <= age_max_ma})

    fig.update_xaxes(
        domain=list(x_domain),
        title_text=None,
        autorange="reversed",
        range=[age_max_ma, age_min_ma],
        gridcolor="#edf2f7",
        zeroline=False,
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        showticklabels=show_axes,
        ticks="inside" if show_axes else "",
        ticklabelposition="inside" if show_axes else "outside",
        tickvals=age_ticks,
        fixedrange=True,
        automargin=False,
    )
    fig.update_yaxes(
        title_text=None,
        autorange="reversed",
        range=[2500, 0],
        gridcolor="#e5e7eb",
        zeroline=False,
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        showticklabels=show_axes,
        ticks="inside" if show_axes else "",
        ticklabelposition="inside" if show_axes else "outside",
        tickvals=[0, 500, 1000, 1500, 2000, 2500],
        ticktext=["0", "0.5", "1.0", "1.5", "2.0", "2.5"],
        fixedrange=False,
        automargin=False,
    )
    fig.update_layout(
        height=height,
        margin={"l": 0, "r": 0, "t": 0, "b": 0},
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        showlegend=False,
    )
    return fig
