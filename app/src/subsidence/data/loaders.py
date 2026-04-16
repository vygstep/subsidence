from __future__ import annotations

import math
from pathlib import Path

import lasio

from .models import DepthReference, LogCurve
from .unit_conversion import convert_depth_to_meters

_DEPTH_MNEMONICS = {"DEPT", "DEPTH", "MD", "TVD", "TVDSS"}


def _is_finite(value: float) -> bool:
    return math.isfinite(value)


def load_las_curves(
    path: str | Path,
    *,
    depth_ref: DepthReference = DepthReference.MD,
    mnemonics: set[str] | None = None,
    depth_unit: str = "m",
) -> list[LogCurve]:
    las = lasio.read(str(path))
    depth_values = convert_depth_to_meters([float(value) for value in las.index], depth_unit)
    requested = {mnemonic.upper() for mnemonic in mnemonics} if mnemonics else None

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
            if _is_finite(depth) and _is_finite(value):
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
            unit=(curve.unit or "").strip(),
            depth_ref=depth_ref,
            depths=ordered_depths,
            values=ordered_values,
        )
        log_curve.validate()
        curves.append(log_curve)

    return curves
