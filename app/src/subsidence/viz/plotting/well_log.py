"""Plotly figure builders for well log display."""
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


@dataclass(frozen=True)
class LithologyInterval:
    label: str
    top_m: float
    base_m: float
    color_hex: str


def _system_label(unit_name: str) -> str:
    mapping = {
        "Quaternary": "Cenozoic",
        "Neogene": "Cenozoic",
        "Paleogene": "Cenozoic",
        "Cretaceous": "Mesozoic",
        "Jurassic": "Mesozoic",
        "Triassic": "Mesozoic",
        "Permian": "Paleozoic",
        "Carboniferous": "Paleozoic",
        "Devonian": "Paleozoic",
        "Silurian": "Paleozoic",
        "Ordovician": "Paleozoic",
    }
    return mapping.get(unit_name, unit_name)


def build_well_figure(
    *,
    well_name: str,
    strat_intervals: list[StratInterval],
    lithology_intervals: list[LithologyInterval],
    curves: list[CurveTrack],
) -> go.Figure:
    fig = make_subplots(
        rows=1,
        cols=5,
        shared_yaxes=True,
        horizontal_spacing=0.01,
        column_widths=[0.04, 0.04, 0.08, 0.08, 0.02],
        specs=[[{"type": "xy"}, {"type": "xy"}, {"type": "xy"}, {"type": "xy"}, {"type": "xy"}]],
    )

    for interval in strat_intervals:
        system_label = _system_label(interval.unit_name)
        mid_depth = (interval.top_m + interval.base_m) / 2
        thickness = interval.base_m - interval.top_m

        fig.add_trace(
            go.Bar(
                x=[1],
                y=[thickness],
                base=[interval.top_m],
                marker={"color": interval.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                hovertemplate=(
                    f"<b>{system_label}</b><br>"
                    "Top: %{base:.1f} m<br>"
                    "Thickness: %{y:.1f} m"
                    "<extra></extra>"
                ),
                showlegend=False,
            ),
            row=1,
            col=1,
        )
        fig.add_annotation(
            x=1, y=mid_depth, text=system_label,
            showarrow=False, font={"size": 10, "color": "#24323f"},
            xref="x1", yref="y1",
        )

        fig.add_trace(
            go.Bar(
                x=[1],
                y=[thickness],
                base=[interval.top_m],
                marker={"color": interval.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                hovertemplate=(
                    f"<b>{interval.unit_name}</b><br>"
                    "Top: %{base:.1f} m<br>"
                    "Thickness: %{y:.1f} m<br>"
                    f"Age: {interval.start_age_ma:.2f} - {interval.end_age_ma:.2f} Ma"
                    "<extra></extra>"
                ),
                showlegend=False,
            ),
            row=1,
            col=2,
        )
        fig.add_annotation(
            x=1, y=mid_depth, text=interval.unit_name,
            showarrow=False, font={"size": 10, "color": "#24323f"},
            xref="x2", yref="y1",
        )

    for lith in lithology_intervals:
        mid_depth = (lith.top_m + lith.base_m) / 2
        fig.add_trace(
            go.Bar(
                x=[1],
                y=[lith.base_m - lith.top_m],
                base=[lith.top_m],
                marker={"color": lith.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                hovertemplate=(
                    f"<b>{lith.label}</b><br>"
                    "Top: %{base:.1f} m<br>"
                    "Thickness: %{y:.1f} m"
                    "<extra></extra>"
                ),
                showlegend=False,
            ),
            row=1,
            col=3,
        )
        fig.add_annotation(
            x=1, y=mid_depth, text=lith.label,
            showarrow=False, font={"size": 10, "color": "#24323f"},
            xref="x3", yref="y1",
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
                    "Depth: %{y:.1f} m<br>"
                    "Value: %{x:.3f}"
                    f" {curve.unit if curve.unit else ''}"
                    "<extra></extra>"
                ),
            ),
            row=1,
            col=4,
        )

    depth_values = (
        [i.top_m for i in strat_intervals]
        + [i.base_m for i in strat_intervals]
        + [d for c in curves for d in c.depths_m]
    )
    min_depth = min([0.0] + depth_values)
    max_depth = max([2500.0] + depth_values)

    fig.add_trace(
        go.Scatter(
            x=[0.5, 0.5],
            y=[min_depth, max_depth],
            mode="lines",
            line={"color": "#94a3b8", "width": 1},
            hoverinfo="skip",
            showlegend=False,
        ),
        row=1,
        col=5,
    )

    step = 250
    start_tick = int(min_depth // step) * step
    end_tick = int(max_depth // step + 1) * step
    for depth in range(start_tick, end_tick + step, step):
        fig.add_annotation(
            x=0.5, y=depth,
            text=f"{depth / 1000:.2f}",
            showarrow=False,
            font={"size": 10, "color": "#334155"},
            xref="x5", yref="y1",
        )

    fig.update_yaxes(
        autorange="reversed", range=[max_depth, min_depth],
        showgrid=False, zeroline=False, showticklabels=False,
        showline=True, mirror=True, linecolor="#94a3b8", linewidth=1,
    )
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0.5, 1.5], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=1)
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0.5, 1.5], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=2)
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0.5, 1.5], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=3)
    fig.update_xaxes(title_text="Log", gridcolor="#eef2f7", zeroline=False, showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=4)
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0, 1], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=5)
    fig.update_layout(
        title=f"Selected Well: {well_name}",
        barmode="overlay",
        height=392,
        margin={"l": 4, "r": 4, "t": 34, "b": 8},
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        legend={"orientation": "h", "y": 1.05, "x": 0},
    )
    return fig
