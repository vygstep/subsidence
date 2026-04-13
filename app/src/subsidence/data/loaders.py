from __future__ import annotations

import csv
import math
import warnings
from pathlib import Path

import lasio
import pandas as pd

from .models import DepthReference
from .models import LogCurve
from .models import StratTopPick
from .models import TopsLoadOptions
from .models import UnconformityPick


_DEPTH_CANDIDATES = ("DEPT", "DEPTH", "MD", "TVD", "TVDSS")


def _is_finite(value: float) -> bool:
    return math.isfinite(value)


def _pairwise_clean(depths: list[float], values: list[float]) -> tuple[list[float], list[float]]:
    clean_depths: list[float] = []
    clean_values: list[float] = []
    for depth, value in zip(depths, values):
        if _is_finite(depth) and _is_finite(value):
            clean_depths.append(depth)
            clean_values.append(value)
    return clean_depths, clean_values


def _drop_duplicate_depths(depths: list[float], values: list[float]) -> tuple[list[float], list[float]]:
    dedup: dict[float, float] = {}
    for depth, value in zip(depths, values):
        dedup[depth] = value
    ordered_depths = sorted(dedup.keys())
    return ordered_depths, [dedup[d] for d in ordered_depths]


def load_las_curves(
    path: str | Path,
    *,
    depth_ref: DepthReference = DepthReference.MD,
    mnemonics: set[str] | None = None,
) -> list[LogCurve]:
    """Load curves from LAS and return validated LogCurve objects."""
    las = lasio.read(str(path))
    depth_values = [float(v) for v in las.index]

    filter_mnemonics = {m.upper() for m in mnemonics} if mnemonics else None
    curves: list[LogCurve] = []

    for curve in las.curves:
        mnemonic = curve.mnemonic.strip()
        upper_mnemonic = mnemonic.upper()

        if upper_mnemonic in _DEPTH_CANDIDATES:
            continue
        if filter_mnemonics and upper_mnemonic not in filter_mnemonics:
            continue

        raw_values = [float(v) for v in las[curve.mnemonic]]
        clean_depths, clean_values = _pairwise_clean(depth_values, raw_values)
        clean_depths, clean_values = _drop_duplicate_depths(clean_depths, clean_values)

        if len(clean_depths) < 2:
            warnings.warn(
                f"Skipping LAS curve '{mnemonic}': less than 2 valid samples",
                stacklevel=2,
            )
            continue

        log_curve = LogCurve(
            mnemonic=mnemonic,
            unit=(curve.unit or "").strip(),
            depth_ref=depth_ref,
            depths=clean_depths,
            values=clean_values,
        )
        log_curve.validate()
        curves.append(log_curve)

    return curves


def _detect_depth_column(columns: list[str]) -> str:
    by_upper = {c.upper(): c for c in columns}
    for candidate in _DEPTH_CANDIDATES:
        if candidate in by_upper:
            return by_upper[candidate]
    return columns[0]


def load_csv_log_curves(
    path: str | Path,
    *,
    depth_ref: DepthReference = DepthReference.MD,
    depth_column: str | None = None,
) -> list[LogCurve]:
    """Load curves from CSV where one column is depth and others are curve values."""
    frame = pd.read_csv(path, sep=None, engine="python")
    if frame.empty:
        return []

    columns = [str(c) for c in frame.columns]
    depth_col = depth_column or _detect_depth_column(columns)
    if depth_col not in frame.columns:
        raise ValueError(f"Depth column '{depth_col}' not found in {path}")

    depths_series = pd.to_numeric(frame[depth_col], errors="coerce")
    curves: list[LogCurve] = []

    for column in frame.columns:
        if column == depth_col:
            continue

        values_series = pd.to_numeric(frame[column], errors="coerce")
        valid_mask = depths_series.notna() & values_series.notna()
        clean_depths = depths_series[valid_mask].astype(float).tolist()
        clean_values = values_series[valid_mask].astype(float).tolist()
        clean_depths, clean_values = _drop_duplicate_depths(clean_depths, clean_values)

        if len(clean_depths) < 2:
            warnings.warn(
                f"Skipping CSV curve '{column}': less than 2 valid samples",
                stacklevel=2,
            )
            continue

        log_curve = LogCurve(
            mnemonic=str(column).strip(),
            unit="",
            depth_ref=depth_ref,
            depths=clean_depths,
            values=clean_values,
        )
        log_curve.validate()
        curves.append(log_curve)

    return curves


def load_strat_tops_csv(
    path: str | Path,
    *,
    options: TopsLoadOptions | None = None,
) -> list[StratTopPick]:
    """Load stratigraphic tops from CSV."""
    opts = options or TopsLoadOptions()
    with Path(path).open("r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        required = {"well_name", "top_name", "depth"}
        missing = required.difference(set(reader.fieldnames or []))
        if missing:
            raise ValueError(f"{path}: missing required columns: {sorted(missing)}")

        picks: list[StratTopPick] = []
        for row in reader:
            strat_age = (row.get("strat_age_ma") or "").strip()
            pick = StratTopPick(
                well_name=row["well_name"].strip(),
                top_name=row["top_name"].strip(),
                depth=float(row["depth"]),
                strat_age_ma=float(strat_age) if strat_age else None,
                depth_ref=opts.depth_ref,
            )
            pick.validate()
            picks.append(pick)
    return picks


def load_unconformities_csv(path: str | Path) -> list[UnconformityPick]:
    """Load unconformity picks from CSV with required MD and age bounds."""
    with Path(path).open("r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        required = {"well_name", "unc_name", "md", "start_age_ma", "base_age_ma"}
        missing = required.difference(set(reader.fieldnames or []))
        if missing:
            raise ValueError(f"{path}: missing required columns: {sorted(missing)}")

        picks: list[UnconformityPick] = []
        for row in reader:
            pick = UnconformityPick(
                well_name=row["well_name"].strip(),
                unc_name=row["unc_name"].strip(),
                md=float(row["md"]),
                start_age_ma=float(row["start_age_ma"]),
                base_age_ma=float(row["base_age_ma"]),
            )
            pick.validate()
            picks.append(pick)
    return picks
