from __future__ import annotations

import math
from pathlib import Path

import lasio
import numpy as np
import pandas as pd

from .models import DepthReference, LogCurve
from .unit_conversion import convert_depth_to_meters

_DEPTH_MNEMONICS = {'DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS'}


def _is_valid_sample(depth: float, value: float, null_value: float | None) -> bool:
    if not math.isfinite(depth) or not math.isfinite(value):
        return False
    if null_value is not None and value == null_value:
        return False
    return True


def load_las_curves(
    path: str | Path,
    *,
    depth_ref: DepthReference = DepthReference.MD,
    mnemonics: set[str] | None = None,
    depth_unit: str = 'm',
) -> list[LogCurve]:
    las = lasio.read(str(path))
    depth_values = convert_depth_to_meters([float(value) for value in las.index], depth_unit)
    requested = {mnemonic.upper() for mnemonic in mnemonics} if mnemonics else None
    null_value = float(getattr(las.well.NULL, 'value', 'nan')) if 'NULL' in las.well else None

    curves: list[LogCurve] = []
    for curve in las.curves:
        mnemonic = curve.mnemonic.strip()
        upper_mnemonic = mnemonic.upper()
        if upper_mnemonic in _DEPTH_MNEMONICS:
            continue
        if requested and upper_mnemonic not in requested:
            continue

        raw_values = [float(value) for value in las[curve.mnemonic]]
        clean_depths: list[float] = []
        clean_values: list[float] = []
        for depth, value in zip(depth_values, raw_values):
            if _is_valid_sample(depth, value, null_value):
                clean_depths.append(depth)
                clean_values.append(value)

        if len(clean_depths) < 2:
            continue

        dedup: dict[float, float] = {}
        for depth, value in zip(clean_depths, clean_values):
            dedup[depth] = value
        ordered_depths = sorted(dedup)
        ordered_values = [dedup[depth] for depth in ordered_depths]

        log_curve = LogCurve(
            mnemonic=mnemonic,
            unit=(curve.unit or '').strip(),
            depth_ref=depth_ref,
            depths=ordered_depths,
            values=ordered_values,
            null_value=null_value if null_value is not None else -999.25,
        )
        log_curve.validate()
        curves.append(log_curve)

    return curves


def load_curves_from_parquet(project_path: str | Path, data_uri: str) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    parquet_path = Path(project_path) / data_uri
    frame = pd.read_parquet(parquet_path)
    if 'DEPT' not in frame.columns:
        raise ValueError(f'Parquet curve file is missing DEPT column: {parquet_path}')

    depths_series = pd.to_numeric(frame['DEPT'], errors='coerce')
    curves: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for column in frame.columns:
        if column == 'DEPT':
            continue
        values_series = pd.to_numeric(frame[column], errors='coerce')
        valid_mask = depths_series.notna() & values_series.notna()
        if valid_mask.sum() < 2:
            continue
        depths = depths_series[valid_mask].astype('float32').to_numpy()
        values = values_series[valid_mask].astype('float32').to_numpy()
        curves[str(column)] = (depths, values)

    return curves
