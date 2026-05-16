from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

DEFAULT_LOG_MD_GRID_STEP_M = 0.2
VERTICAL_TVD_IMPORT_WARNING = (
    'No deviation survey loaded. The well is treated as vertical for this import. '
    'If deviation is loaded later, these logs may need to be reimported because their MD positions '
    'were derived from TVD/TVDSS using a vertical-well assumption.'
)

DepthToMdConverter = Callable[[float], float | None]


@dataclass(frozen=True)
class ResampledCurve:
    depths: list[float]
    values: list[float | None]
    valid_depth_min: float | None
    valid_depth_max: float | None
    valid_sample_count: int


@dataclass(frozen=True)
class DepthConversionResult:
    depths_md: list[float]
    warning: str | None = None


def build_md_grid(td_md: float, step_m: float = DEFAULT_LOG_MD_GRID_STEP_M) -> list[float]:
    if not np.isfinite(td_md) or td_md < 0:
        raise ValueError('TD must be a finite non-negative number')
    if not np.isfinite(step_m) or step_m <= 0:
        raise ValueError('MD grid step must be a positive finite number')
    decimals = max(0, int(np.ceil(-np.log10(step_m))) + 3) if step_m < 1 else 6
    count = int(np.floor(td_md / step_m + 1e-9)) + 1
    grid = np.arange(count, dtype='float64') * step_m
    grid = grid[grid <= td_md + step_m * 1e-6]
    if grid.size == 0 or grid[-1] < td_md - step_m * 1e-6:
        grid = np.append(grid, td_md)
    return np.round(grid, decimals=decimals).tolist()


def convert_source_depths_to_md(
    depths: list[float],
    *,
    depth_reference: str,
    kb_elev: float,
    tvd_to_md: DepthToMdConverter | None = None,
) -> DepthConversionResult:
    ref = depth_reference.strip().upper()
    if ref == 'MD':
        return DepthConversionResult(depths_md=list(depths))
    if ref not in {'TVD', 'TVDSS'}:
        raise ValueError(f'Unsupported log depth reference: {depth_reference}')

    tvd_values = [depth + kb_elev for depth in depths] if ref == 'TVDSS' else list(depths)
    if tvd_to_md is None:
        return DepthConversionResult(depths_md=tvd_values, warning=VERTICAL_TVD_IMPORT_WARNING)

    converted: list[float] = []
    for tvd in tvd_values:
        md = tvd_to_md(float(tvd))
        if md is None or not np.isfinite(md):
            raise ValueError(f'Could not convert {ref} depth {tvd!r} to MD using deviation survey')
        converted.append(float(md))
    return DepthConversionResult(depths_md=converted)


def _prepare_native_samples(
    depths_md: list[float],
    values: list[float | None],
) -> tuple[np.ndarray, np.ndarray]:
    if len(depths_md) != len(values):
        raise ValueError('Depth and value arrays must have the same length')
    pairs: list[tuple[float, float]] = []
    for depth, value in zip(depths_md, values, strict=False):
        if not np.isfinite(depth):
            continue
        next_value = np.nan if value is None or not np.isfinite(value) else float(value)
        pairs.append((float(depth), next_value))
    if not pairs:
        return np.array([], dtype='float64'), np.array([], dtype='float64')
    pairs.sort(key=lambda item: item[0])
    deduped: dict[float, float] = {}
    for depth, value in pairs:
        deduped[depth] = value
    native_depths = np.array(list(deduped.keys()), dtype='float64')
    native_values = np.array(list(deduped.values()), dtype='float64')
    return native_depths, native_values


def _result_from_values(grid: list[float], values: np.ndarray) -> ResampledCurve:
    valid_mask = np.isfinite(values)
    valid_depths = np.array(grid, dtype='float64')[valid_mask]
    return ResampledCurve(
        depths=list(grid),
        values=[float(value) if np.isfinite(value) else None for value in values],
        valid_depth_min=float(valid_depths[0]) if valid_depths.size else None,
        valid_depth_max=float(valid_depths[-1]) if valid_depths.size else None,
        valid_sample_count=int(valid_mask.sum()),
    )


def resample_continuous_to_md_grid(
    grid: list[float],
    native_depths_md: list[float],
    native_values: list[float | None],
) -> ResampledCurve:
    depths, values = _prepare_native_samples(native_depths_md, native_values)
    result = np.full(len(grid), np.nan, dtype='float64')
    if depths.size < 2:
        return _result_from_values(grid, result)
    grid_arr = np.array(grid, dtype='float64')
    step = float(np.min(np.diff(grid_arr))) if grid_arr.size > 1 else 1e-6
    tolerance = max(step * 1e-6, 1e-9)
    for depth, value in zip(depths, values, strict=False):
        if not np.isfinite(value):
            continue
        exact_mask = np.isclose(grid_arr, depth, rtol=0.0, atol=tolerance)
        result[exact_mask] = value
    for idx in range(len(depths) - 1):
        left_value = values[idx]
        right_value = values[idx + 1]
        if not np.isfinite(left_value) or not np.isfinite(right_value):
            continue
        left_depth = depths[idx]
        right_depth = depths[idx + 1]
        if right_depth <= left_depth:
            continue
        mask = (grid_arr >= left_depth) & (grid_arr <= right_depth)
        if mask.any():
            result[mask] = np.interp(grid_arr[mask], [left_depth, right_depth], [left_value, right_value])
    return _result_from_values(grid, result)


def resample_discrete_to_md_grid(
    grid: list[float],
    native_depths_md: list[float],
    native_values: list[float | None],
) -> ResampledCurve:
    depths, values = _prepare_native_samples(native_depths_md, native_values)
    result = np.full(len(grid), np.nan, dtype='float64')
    if depths.size == 0:
        return _result_from_values(grid, result)
    grid_arr = np.array(grid, dtype='float64')
    for idx, depth in enumerate(depths):
        value = values[idx]
        if not np.isfinite(value):
            continue
        next_depth = depths[idx + 1] if idx + 1 < len(depths) else depth
        if next_depth < depth:
            continue
        if idx + 1 < len(depths):
            mask = (grid_arr >= depth) & (grid_arr < next_depth)
        else:
            mask = grid_arr == depth
        result[mask] = value
    return _result_from_values(grid, result)


def resample_curve_to_md_grid(
    grid: list[float],
    native_depths_md: list[float],
    native_values: list[float | None],
    *,
    curve_type: str,
) -> ResampledCurve:
    if curve_type == 'discrete':
        return resample_discrete_to_md_grid(grid, native_depths_md, native_values)
    return resample_continuous_to_md_grid(grid, native_depths_md, native_values)
