from __future__ import annotations

import csv
import math
import warnings
from pathlib import Path
import lasio
import pandas as pd

from .curve_dictionary import load_curve_alias_rules
from .curve_dictionary import resolve_curve_alias
from .models import BoundaryType
from .models import DepthReference
from .models import LogCurve
from .models import StratChart
from .models import StratTopPick
from .models import TopUnconformityLink
from .models import TopsLoadOptions
from .models import UnconformityPick
from .models import make_strat_chart
from .unit_conversion import canonicalize_gamma_unit
from .unit_conversion import convert_curve_units
from .unit_conversion import convert_depth_to_meters
from .unit_conversion import normalize_unit_name


_DEPTH_CANDIDATES = ("DEPT", "DEPTH", "MD", "TVD", "TVDSS")


def _read_csv_rows(path: str | Path) -> tuple[list[str], list[dict[str, str]]]:
    p = Path(path)
    with p.open("r", newline="", encoding="utf-8") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        delimiter = ","
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;")
            delimiter = dialect.delimiter
        except csv.Error:
            pass

        reader = csv.DictReader(fh, delimiter=delimiter)
        rows = [dict(row) for row in reader]
        return list(reader.fieldnames or []), rows


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
    dictionary_db_path: str | Path | None = None,
    depth_unit: str = "m",
) -> list[LogCurve]:
    """Load curves from LAS and return validated LogCurve objects."""
    las = lasio.read(str(path))
    depth_values = [float(v) for v in las.index]
    depth_values = convert_depth_to_meters(depth_values, depth_unit)
    rules = load_curve_alias_rules(dictionary_db_path) if dictionary_db_path else []

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

        source_unit = (curve.unit or "").strip()
        match = resolve_curve_alias(mnemonic, rules) if rules else None
        family_code = match.family_code if match else None
        standard_mnemonic = match.canonical_mnemonic if match else None
        target_unit = (match.canonical_unit if match else None) or source_unit

        if family_code == "gamma_ray":
            target_unit = canonicalize_gamma_unit(target_unit)

        values = clean_values
        if source_unit and target_unit and normalize_unit_name(source_unit) != normalize_unit_name(target_unit):
            try:
                values = convert_curve_units(
                    values,
                    from_unit=source_unit,
                    to_unit=target_unit,
                    family_code=family_code,
                )
            except ValueError as err:
                warnings.warn(
                    f"Curve '{mnemonic}': {err}; keeping original unit '{source_unit}'",
                    stacklevel=2,
                )
                target_unit = source_unit

        if rules and match and not match.matched:
            warnings.warn(
                f"Curve '{mnemonic}' is not mapped in dictionary; keeping pass-through",
                stacklevel=2,
            )

        log_curve = LogCurve(
            mnemonic=mnemonic,
            standard_mnemonic=standard_mnemonic,
            family_code=family_code,
            unit=target_unit,
            original_unit=source_unit,
            depth_ref=depth_ref,
            depths=clean_depths,
            values=values,
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
    depth_unit: str = "m",
    dictionary_db_path: str | Path | None = None,
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
    rules = load_curve_alias_rules(dictionary_db_path) if dictionary_db_path else []
    curves: list[LogCurve] = []

    for column in frame.columns:
        if column == depth_col:
            continue

        values_series = pd.to_numeric(frame[column], errors="coerce")
        valid_mask = depths_series.notna() & values_series.notna()
        clean_depths = depths_series[valid_mask].astype(float).tolist()
        clean_values = values_series[valid_mask].astype(float).tolist()
        clean_depths, clean_values = _drop_duplicate_depths(clean_depths, clean_values)
        clean_depths = convert_depth_to_meters(clean_depths, depth_unit)

        if len(clean_depths) < 2:
            warnings.warn(
                f"Skipping CSV curve '{column}': less than 2 valid samples",
                stacklevel=2,
            )
            continue

        raw_mnemonic = str(column).strip()
        match = resolve_curve_alias(raw_mnemonic, rules) if rules else None
        family_code = match.family_code if match else None
        standard_mnemonic = match.canonical_mnemonic if match else None
        target_unit = (match.canonical_unit if match else None) or ""
        if family_code == "gamma_ray":
            target_unit = canonicalize_gamma_unit(target_unit)

        if rules and match and not match.matched:
            warnings.warn(
                f"Curve '{raw_mnemonic}' is not mapped in dictionary; keeping pass-through",
                stacklevel=2,
            )

        log_curve = LogCurve(
            mnemonic=raw_mnemonic,
            standard_mnemonic=standard_mnemonic,
            family_code=family_code,
            original_unit="",
            unit=target_unit,
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
    fieldnames, rows = _read_csv_rows(path)
    required = {"well_name", "top_name", "depth"}
    missing = required.difference(set(fieldnames))
    if missing:
        raise ValueError(f"{path}: missing required columns: {sorted(missing)}")

    picks: list[StratTopPick] = []
    for row in rows:
        strat_age = (row.get("strat_age_ma") or "").strip()
        boundary_type_raw = (row.get("boundary_type") or "conformable").strip().lower()
        boundary_type = (
            BoundaryType.UNCONFORMITY
            if boundary_type_raw == "unconformity"
            else BoundaryType.CONFORMABLE
        )
        pick = StratTopPick(
            well_name=row["well_name"].strip(),
            top_name=row["top_name"].strip(),
            depth=float(row["depth"]),
            strat_age_ma=float(strat_age) if strat_age else None,
            depth_ref=opts.depth_ref,
            boundary_type=boundary_type,
            unconformity_ref=(row.get("unconformity_ref") or "").strip() or None,
        )
        pick.validate()
        picks.append(pick)
    return picks


def load_unconformities_csv(path: str | Path) -> list[UnconformityPick]:
    """Load unconformity picks from CSV with required MD and age bounds."""
    fieldnames, rows = _read_csv_rows(path)
    required = {"well_name", "unc_name", "md", "start_age_ma", "base_age_ma"}
    missing = required.difference(set(fieldnames))
    if missing:
        raise ValueError(f"{path}: missing required columns: {sorted(missing)}")

    picks: list[UnconformityPick] = []
    for row in rows:
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


def load_strat_chart_csv(
    units_path: str | Path,
    ranks_path: str | Path,
) -> StratChart:
    """Load stratigraphic chart from units and ranks CSV files."""
    _, units_rows = _read_csv_rows(units_path)
    _, ranks_rows = _read_csv_rows(ranks_path)
    return make_strat_chart(units_rows=units_rows, ranks_rows=ranks_rows)


def link_strat_tops_to_unconformities(
    strat_tops: list[StratTopPick],
    unconformities: list[UnconformityPick],
    *,
    depth_tolerance_m: float = 0.1,
) -> list[TopUnconformityLink]:
    by_name = {(u.well_name, u.unc_name): u for u in unconformities}
    by_well: dict[str, list[UnconformityPick]] = {}
    for unconformity in unconformities:
        by_well.setdefault(unconformity.well_name, []).append(unconformity)

    links: list[TopUnconformityLink] = []
    for top in strat_tops:
        if top.unconformity_ref:
            key = (top.well_name, top.unconformity_ref)
            target = by_name.get(key)
            if target:
                links.append(
                    TopUnconformityLink(
                        well_name=top.well_name,
                        top_name=top.top_name,
                        unconformity_name=target.unc_name,
                        top_depth=top.depth,
                        unconformity_md=target.md,
                        link_method="ref",
                    )
                )
            continue

        nearest = None
        nearest_delta = None
        for unconformity in by_well.get(top.well_name, []):
            delta = abs(top.depth - unconformity.md)
            if delta <= depth_tolerance_m and (nearest_delta is None or delta < nearest_delta):
                nearest = unconformity
                nearest_delta = delta

        if nearest is not None:
            links.append(
                TopUnconformityLink(
                    well_name=top.well_name,
                    top_name=top.top_name,
                    unconformity_name=nearest.unc_name,
                    top_depth=top.depth,
                    unconformity_md=nearest.md,
                    link_method="depth",
                )
            )

    return links
