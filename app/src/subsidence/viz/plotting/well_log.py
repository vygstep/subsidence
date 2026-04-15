"""Plotly figure builders for well log display."""
from __future__ import annotations

from dataclasses import dataclass

import plotly.graph_objects as go


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


def _depth_bounds(
    strat_intervals: list[StratInterval],
    lithology_intervals: list[LithologyInterval],
    curves: list[CurveTrack],
) -> tuple[float, float]:
    depth_values = [0.0]
    for interval in strat_intervals:
        depth_values.extend([interval.top_m, interval.base_m])
    for interval in lithology_intervals:
        depth_values.extend([interval.top_m, interval.base_m])
    for curve in curves:
        depth_values.extend(curve.depths_m)
    min_depth = min(depth_values)
    max_depth = max(depth_values + [2500.0])
    return min_depth, max_depth


def _base_track_figure(*, min_depth: float, max_depth: float, show_depth_ticks: bool = False) -> go.Figure:
    fig = go.Figure()
    fig.update_yaxes(
        autorange="reversed",
        range=[max_depth, min_depth],
        showgrid=False,
        zeroline=False,
        showticklabels=show_depth_ticks,
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        tickvals=[0, 500, 1000, 1500, 2000, 2500],
        ticktext=["0", "0.5", "1.0", "1.5", "2.0", "2.5"] if show_depth_ticks else None,
        ticks="outside" if show_depth_ticks else "",
    )
    fig.update_layout(
        height=392,
        margin={"l": 0, "r": 0, "t": 26, "b": 8},
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        showlegend=False,
        barmode="overlay",
    )
    return fig


def build_strat_track_figure(
    *,
    strat_intervals: list[StratInterval],
    min_depth: float,
    max_depth: float,
) -> go.Figure:
    fig = _base_track_figure(min_depth=min_depth, max_depth=max_depth)

    for interval in strat_intervals:
        thickness = interval.base_m - interval.top_m
        mid_depth = (interval.top_m + interval.base_m) / 2
        system_name = _system_label(interval.unit_name)

        fig.add_trace(
            go.Bar(
                x=[1],
                y=[thickness],
                base=[interval.top_m],
                marker={"color": interval.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                hovertemplate=(
                    f"<b>Loaded unit: {interval.unit_name}</b><br>"
                    f"Loaded system: {system_name}<br>"
                    "Top: %{base:.1f} m<br>"
                    "Thickness: %{y:.1f} m<br>"
                    f"Age: {interval.start_age_ma:.2f} - {interval.end_age_ma:.2f} Ma"
                    "<extra></extra>"
                ),
                showlegend=False,
            )
        )
        fig.add_annotation(
            x=1,
            y=mid_depth,
            text=interval.unit_name,
            showarrow=False,
            font={"size": 8, "color": "#24323f"},
            xref="x",
            yref="y",
        )

    fig.update_xaxes(
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        range=[0.5, 1.5],
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        fixedrange=True,
    )
    return fig


def build_lithology_track_figure(
    *,
    lithology_intervals: list[LithologyInterval],
    min_depth: float,
    max_depth: float,
) -> go.Figure:
    fig = _base_track_figure(min_depth=min_depth, max_depth=max_depth)
    for interval in lithology_intervals:
        thickness = interval.base_m - interval.top_m
        mid_depth = (interval.top_m + interval.base_m) / 2
        fig.add_trace(
            go.Bar(
                x=[1],
                y=[thickness],
                base=[interval.top_m],
                marker={"color": interval.color_hex, "line": {"color": "#64748b", "width": 0.6}},
                hovertemplate=(
                    f"<b>{interval.label}</b><br>"
                    "Top: %{base:.1f} m<br>"
                    "Thickness: %{y:.1f} m"
                    "<extra></extra>"
                ),
                showlegend=False,
            )
        )
        fig.add_annotation(
            x=1,
            y=mid_depth,
            text=interval.label,
            showarrow=False,
            font={"size": 9, "color": "#24323f"},
            xref="x",
            yref="y",
        )
    fig.update_xaxes(
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        range=[0.5, 1.5],
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        fixedrange=True,
    )
    return fig


def build_log_track_figure(
    *,
    curves: list[CurveTrack],
    min_depth: float,
    max_depth: float,
) -> go.Figure:
    fig = _base_track_figure(min_depth=min_depth, max_depth=max_depth)
    all_values: list[float] = []
    for curve in curves:
        all_values.extend(curve.values)
        fig.add_trace(
            go.Scatter(
                x=curve.values,
                y=curve.depths_m,
                mode="lines",
                line={"color": curve.color, "width": 1.8},
                hovertemplate=(
                    f"<b>{curve.mnemonic}</b><br>"
                    "Depth: %{y:.1f} m<br>"
                    "Value: %{x:.3f}"
                    f" {curve.unit if curve.unit else ''}"
                    "<extra></extra>"
                ),
                showlegend=False,
            )
        )
    if all_values:
        value_min = min(all_values)
        value_max = max(all_values)
        if abs(value_max - value_min) < 1e-9:
            value_min -= 1.0
            value_max += 1.0
    else:
        value_min, value_max = 0.0, 1.0

    fig.update_xaxes(
        title_text=None,
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        ticks="",
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        range=[value_min, value_max],
        fixedrange=False,
    )
    return fig


def build_depth_track_figure(*, min_depth: float, max_depth: float) -> go.Figure:
    fig = _base_track_figure(min_depth=min_depth, max_depth=max_depth, show_depth_ticks=True)
    fig.add_trace(
        go.Scatter(
            x=[0.5, 0.5],
            y=[min_depth, max_depth],
            mode="lines",
            line={"color": "#94a3b8", "width": 1},
            hoverinfo="skip",
            showlegend=False,
        )
    )
    fig.update_xaxes(
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        range=[0, 1],
        showline=True,
        mirror=True,
        linecolor="#94a3b8",
        linewidth=1,
        fixedrange=True,
    )
    return fig


def build_well_figure(
    *,
    well_name: str,
    strat_intervals: list[StratInterval],
    lithology_intervals: list[LithologyInterval],
    curves: list[CurveTrack],
) -> go.Figure:
    """Legacy combined figure kept for backward compatibility while the app migrates to independent tracks."""
    from plotly.subplots import make_subplots

    fig = make_subplots(
        rows=1,
        cols=4,
        shared_yaxes=True,
        horizontal_spacing=0.01,
        column_widths=[0.08, 0.08, 0.12, 0.03],
        specs=[[{"type": "xy"}, {"type": "xy"}, {"type": "xy"}, {"type": "xy"}]],
    )

    for interval in strat_intervals:
        system_label = _system_label(interval.unit_name)
        mid_depth = (interval.top_m + interval.base_m) / 2
        thickness = interval.base_m - interval.top_m
        fig.add_trace(go.Bar(x=[0.5], y=[thickness], base=[interval.top_m], width=[0.9], marker={"color": interval.color_hex, "line": {"color": "#64748b", "width": 0.6}}, showlegend=False), row=1, col=1)
        fig.add_annotation(x=0.5, y=mid_depth, text=system_label, showarrow=False, font={"size": 9, "color": "#24323f"}, xref="x1", yref="y1")
        fig.add_trace(go.Bar(x=[1.5], y=[thickness], base=[interval.top_m], width=[0.9], marker={"color": interval.color_hex, "line": {"color": "#64748b", "width": 0.6}}, showlegend=False), row=1, col=1)
        fig.add_annotation(x=1.5, y=mid_depth, text=interval.unit_name, showarrow=False, font={"size": 9, "color": "#24323f"}, xref="x1", yref="y1")

    for lith in lithology_intervals:
        mid_depth = (lith.top_m + lith.base_m) / 2
        fig.add_trace(go.Bar(x=[1], y=[lith.base_m - lith.top_m], base=[lith.top_m], marker={"color": lith.color_hex, "line": {"color": "#64748b", "width": 0.6}}, showlegend=False), row=1, col=2)
        fig.add_annotation(x=1, y=mid_depth, text=lith.label, showarrow=False, font={"size": 10, "color": "#24323f"}, xref="x2", yref="y1")

    for curve in curves:
        fig.add_trace(go.Scatter(x=curve.values, y=curve.depths_m, mode="lines", line={"color": curve.color, "width": 1.8}, showlegend=False), row=1, col=3)

    min_depth, max_depth = _depth_bounds(strat_intervals, lithology_intervals, curves)
    fig.add_trace(go.Scatter(x=[0.5, 0.5], y=[min_depth, max_depth], mode="lines", line={"color": "#94a3b8", "width": 1}, hoverinfo="skip", showlegend=False), row=1, col=4)
    fig.update_yaxes(autorange="reversed", range=[max_depth, min_depth], showgrid=False, zeroline=False, showticklabels=False, showline=True, mirror=True, linecolor="#94a3b8", linewidth=1)
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0, 2], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=1)
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0.5, 1.5], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=2)
    fig.update_xaxes(gridcolor="#eef2f7", zeroline=False, showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=3)
    fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False, range=[0, 1], showline=True, mirror=True, linecolor="#94a3b8", linewidth=1, row=1, col=4)
    fig.update_layout(title=f"Selected Well: {well_name}", barmode="overlay", height=392, margin={"l": 4, "r": 4, "t": 34, "b": 8}, paper_bgcolor="#ffffff", plot_bgcolor="#ffffff", showlegend=False)
    return fig
