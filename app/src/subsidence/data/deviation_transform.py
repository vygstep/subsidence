from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
from sqlalchemy.orm import Session

from .schema import DeviationSurveyModel, FormationTopModel, WellModel


def _load_survey_arrays_with_incl(
    project_path: Path,
    survey: DeviationSurveyModel,
) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """Load deviation parquet and return (md_array, tvd_array, incl_array) via min-curvature.

    Only INCL_AZIM mode is supported; other modes return None.
    """
    if survey.mode != 'INCL_AZIM':
        return None

    parquet_path = project_path / survey.data_uri
    if not parquet_path.exists():
        return None

    table = pq.read_table(parquet_path)
    df = table.to_pandas()

    # Detect depth column name (md / tvd / tvdss depending on reference)
    depth_col = next(
        (c for c in df.columns if c.lower() in ('md', 'tvd', 'tvdss')),
        None,
    )
    if depth_col is None or 'incl_deg' not in df.columns or 'azim_deg' not in df.columns:
        return None

    md_arr = df[depth_col].to_numpy(dtype=float)
    incl_arr = df['incl_deg'].to_numpy(dtype=float)
    azim_arr = df['azim_deg'].to_numpy(dtype=float)

    md_arr, tvd_arr = _min_curvature(md_arr, incl_arr, azim_arr)
    return md_arr, tvd_arr, incl_arr


def _load_survey_arrays(project_path: Path, survey: DeviationSurveyModel) -> tuple[np.ndarray, np.ndarray] | None:
    arrays = _load_survey_arrays_with_incl(project_path, survey)
    if arrays is None:
        return None
    md_arr, tvd_arr, _incl_arr = arrays
    return md_arr, tvd_arr


def _min_curvature(
    md: np.ndarray,
    incl_deg: np.ndarray,
    azim_deg: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Minimum-curvature TVD calculation.

    Mirrors the JavaScript implementation in frontend/src/utils/depthTransform.ts.
    Returns (md_array, tvd_array).
    """
    n = len(md)
    tvd = np.zeros(n, dtype=float)

    for i in range(1, n):
        dmd = float(md[i] - md[i - 1])
        i1 = math.radians(float(incl_deg[i - 1]))
        i2 = math.radians(float(incl_deg[i]))
        a1 = math.radians(float(azim_deg[i - 1]))
        a2 = math.radians(float(azim_deg[i]))

        cos_alpha = math.cos(i2 - i1) - math.sin(i1) * math.sin(i2) * (1.0 - math.cos(a2 - a1))
        alpha = math.acos(max(-1.0, min(1.0, cos_alpha)))

        rf = 1.0 if alpha < 1e-10 else (2.0 / alpha) * math.tan(alpha / 2.0)
        tvd[i] = tvd[i - 1] + (dmd / 2.0) * (math.cos(i1) + math.cos(i2)) * rf

    return md, tvd


def _interpolate(value: float, x_arr: np.ndarray, y_arr: np.ndarray) -> float:
    """Linear interpolation with clamping at boundaries."""
    if len(x_arr) == 0:
        return value
    if value <= x_arr[0]:
        return float(y_arr[0])
    if value >= x_arr[-1]:
        return float(y_arr[-1])

    idx = int(np.searchsorted(x_arr, value, side='right')) - 1
    idx = max(0, min(idx, len(x_arr) - 2))
    t = (value - x_arr[idx]) / (x_arr[idx + 1] - x_arr[idx])
    return float(y_arr[idx]) + t * float(y_arr[idx + 1] - y_arr[idx])


def md_to_tvd_with_extrapolation(
    depth_md: float,
    md_arr: np.ndarray,
    tvd_arr: np.ndarray,
    incl_arr: np.ndarray,
) -> float:
    """Interpolate MD to TVD and extend below the last station using last inclination."""
    if len(md_arr) == 0:
        return depth_md
    if depth_md <= md_arr[0]:
        return float(tvd_arr[0])
    if depth_md > md_arr[-1]:
        last_incl_rad = math.radians(float(incl_arr[-1])) if len(incl_arr) else 0.0
        return float(tvd_arr[-1]) + (depth_md - float(md_arr[-1])) * math.cos(last_incl_rad)
    return _interpolate(depth_md, md_arr, tvd_arr)


def deviation_extrapolation_warning_for_import(
    project_path: Path | str,
    well: WellModel,
    imported_max_md: float | None,
) -> str | None:
    if imported_max_md is None or well.deviation_survey is None:
        return None

    arrays = _load_survey_arrays_with_incl(Path(project_path), well.deviation_survey)
    if arrays is None:
        return None

    md_arr, _tvd_arr, _incl_arr = arrays
    if len(md_arr) == 0:
        return None
    survey_max_md = float(md_arr[-1])
    if imported_max_md <= survey_max_md:
        return None

    return (
        f'Deviation survey ends at {survey_max_md:.1f} m; '
        'TVD/TVDSS below this depth uses the last inclination/azimuth.'
    )


def compute_tvd_tvdss(
    project_path: Path | str,
    well: WellModel,
    depth_md: float,
) -> tuple[float | None, float | None]:
    """Return (tvd, tvdss) for a given MD value.

    Uses the well's deviation survey if available (INCL_AZIM mode only).
    TVDSS = TVD - kb_elev.
    Returns (None, None) if survey is missing or unsupported.
    """
    project_path = Path(project_path)
    survey = well.deviation_survey
    if survey is None:
        return None, None

    arrays = _load_survey_arrays_with_incl(project_path, survey)
    if arrays is None:
        return None, None

    md_arr, tvd_arr, incl_arr = arrays
    tvd = md_to_tvd_with_extrapolation(depth_md, md_arr, tvd_arr, incl_arr)
    tvdss = tvd - well.kb_elev
    return tvd, tvdss


def tvd_to_md(
    tvd_value: float,
    project_path: Path | str,
    well: WellModel,
) -> float | None:
    """Back-calculate MD from a TVD value using the well's deviation survey.

    Returns None if no survey or TVD array is not strictly increasing.
    """
    project_path = Path(project_path)
    survey = well.deviation_survey
    if survey is None:
        return None

    arrays = _load_survey_arrays(project_path, survey)
    if arrays is None:
        return None

    md_arr, tvd_arr = arrays
    # Check monotonicity
    if not np.all(np.diff(tvd_arr) >= 0):
        return None

    return _interpolate(tvd_value, tvd_arr, md_arr)


def recalculate_picks_tvd(
    session: Session,
    project_path: Path | str,
    well: WellModel,
) -> int:
    """Recalculate depth_tvd and depth_tvdss for all picks of a well.

    Returns count of updated records.
    """
    project_path = Path(project_path)
    survey = well.deviation_survey
    if survey is None:
        return 0

    arrays = _load_survey_arrays_with_incl(project_path, survey)
    if arrays is None:
        return 0

    md_arr, tvd_arr, incl_arr = arrays
    count = 0
    for pick in session.query(FormationTopModel).filter(
        FormationTopModel.well_id == well.id,
        FormationTopModel.depth_md.is_not(None),
    ).all():
        tvd = md_to_tvd_with_extrapolation(float(pick.depth_md), md_arr, tvd_arr, incl_arr)
        pick.depth_tvd = tvd
        pick.depth_tvdss = tvd - well.kb_elev
        count += 1

    return count
