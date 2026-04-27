"""
Burial history with Athy decompaction.

Decompaction math (integrate_porosity, calculate_matrix_thickness, _compact_layer)
follows the algorithm in repos/pybasin/lib/pybasin_lib.py (Athy 1930 exponential
porosity-depth model). Burial history loop follows the pattern in
repos/Stratya2D/backstripping.py.

Unit convention
---------------
- c (compaction coefficient) is stored in the DB in km⁻¹.
  All internal calculations use c in m⁻¹: c_m = c_km / 1000.0.
- depths and thicknesses are in metres throughout.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Athy decompaction functions (pybasin_lib.py algorithm)
# ---------------------------------------------------------------------------

def _integrate_porosity(n0: float, c: float, z1: float, z2: float) -> float:
    """Average porosity integrated over depth interval [z1, z2]. c in m⁻¹."""
    b_w = n0 / c * (math.exp(-c * z1) - math.exp(-c * z2))
    return b_w / (z2 - z1)


def _matrix_thickness(n0: float, c: float, z1: float, z2: float) -> float:
    """Solid matrix thickness for a layer from z1 to z2. c in m⁻¹."""
    b_w = (z2 - z1) * _integrate_porosity(n0, c, z1, z2)
    return (z2 - z1) - b_w


def _layer_thickness_at_depth(
    bm: float,
    n0: float,
    c: float,
    z_top: float,
    initial_guess: float,
    max_error: float = 0.01,
    max_iter: int = 100,
) -> float:
    """
    Find decompacted layer thickness when layer top is at z_top.
    Iterative fixed-point: bi = bm + pore_volume(z_top, z_top+bi).
    c in m⁻¹.
    """
    bi = max(initial_guess, bm)
    for _ in range(max_iter):
        z2 = z_top + bi
        bw = _integrate_porosity(n0, c, z_top, z2) * (z2 - z_top)
        bi_new = bm + bw
        if abs(bi_new - bi) <= max_error:
            return bi_new
        bi = bi_new
    return bi


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class LithologyParam:
    density: float           # grain density, kg/m³
    porosity_surface: float  # φ₀, fraction 0–1
    compaction_coeff: float  # c, km⁻¹ — converted to m⁻¹ inside engine


DEFAULT_LITHO_PARAM = LithologyParam(density=2720.0, porosity_surface=0.63, compaction_coeff=0.51)


@dataclass
class FormationInput:
    name: str
    color: str           # hex color for display (from LithologyDictEntry or formation itself)
    lithology: str       # lithology_code key into litho_params
    age_top_ma: float    # age at formation top (younger boundary, Ma)
    age_base_ma: float   # age at formation base (older boundary, Ma)
    current_top_m: float
    current_base_m: float
    water_depth_m: float = 0.0


@dataclass
class ZoneLayerInput:
    name: str
    color: str
    lithology: str            # dominant lithology code (for display)
    litho_param: LithologyParam  # pre-computed weighted params
    age_top_ma: float | None
    age_base_ma: float | None
    current_top_m: float
    current_base_m: float
    water_depth_m: float = 0.0
    eroded_thickness_m: float = 0.0


@dataclass
class BurialPoint:
    age_ma: float
    depth_m: float


@dataclass
class SubsidenceResult:
    formation_name: str
    color: str
    lithology: str
    burial_path: list[BurialPoint] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Sea level interpolation
# ---------------------------------------------------------------------------

def _sea_level_at(age_ma: float, curve: list[tuple[float, float]]) -> float:
    """Linear interpolation on a sea level curve sorted descending by age_ma."""
    if not curve:
        return 0.0
    if age_ma >= curve[0][0]:
        return curve[0][1]
    if age_ma <= curve[-1][0]:
        return curve[-1][1]
    for i in range(len(curve) - 1):
        a1, v1 = curve[i]
        a2, v2 = curve[i + 1]
        if a2 <= age_ma <= a1:
            t = (age_ma - a2) / (a1 - a2)
            return v2 + t * (v1 - v2)
    return 0.0


# ---------------------------------------------------------------------------
# Backstripping
# ---------------------------------------------------------------------------

def backstrip(
    formations: list[FormationInput | ZoneLayerInput],
    litho_params: dict[str, LithologyParam],
    sea_level_curve: list[tuple[float, float]] | None = None,
) -> list[SubsidenceResult]:
    """
    Airy backstripping with Athy decompaction (Stratya2D algorithm pattern).

    Accepts FormationInput (looks up litho_params by lithology code) or
    ZoneLayerInput (uses its pre-computed litho_param directly).

    Per-layer water_depth_m: at each time step the shallowest active layer's
    water_depth_m is used to offset the whole paleo column.

    ZoneLayerInput.eroded_thickness_m: ghost solid matrix added to the layer's
    conserved solid volume to represent material removed by erosion.

    sea_level_curve: [(age_ma, sea_level_m), ...] sorted descending by age_ma.
    Interpolated and added to the depth offset at each time step.
    """
    # Filter and sort oldest-base first (deepest in the column)
    valid = [
        f for f in formations
        if f.age_top_ma is not None and f.age_base_ma is not None
        and f.current_base_m > f.current_top_m
    ]
    if len(valid) < 2:
        return []

    valid.sort(key=lambda f: f.age_base_ma, reverse=True)  # oldest base = index 0

    def _litho(f: FormationInput | ZoneLayerInput) -> LithologyParam:
        if isinstance(f, ZoneLayerInput):
            return f.litho_param
        return litho_params.get(f.lithology, DEFAULT_LITHO_PARAM)

    # Pre-compute solid matrix thickness (conserved quantity); include eroded ghost section
    solid_m: dict[int, float] = {}
    for i, f in enumerate(valid):
        lp = _litho(f)
        c_m = lp.compaction_coeff / 1000.0
        eroded = f.eroded_thickness_m if isinstance(f, ZoneLayerInput) else 0.0
        effective_base = f.current_base_m + eroded
        solid_m[i] = _matrix_thickness(lp.porosity_surface, c_m, f.current_top_m, effective_base)

    # Time steps: all formation top ages + 0 (present), oldest first
    time_steps = sorted(
        {f.age_top_ma for f in valid} | {0.0},
        reverse=True,
    )

    # Track burial path for each formation
    results = [
        SubsidenceResult(
            formation_name=f.name,
            color=f.color,
            lithology=f.lithology,
        )
        for f in valid
    ]

    for t_ma in time_steps:
        # Active formations at this time step (already deposited)
        active_indices = [i for i, f in enumerate(valid) if f.age_top_ma >= t_ma]
        if not active_indices:
            continue

        # Build paleo column from basement upward (reversed = youngest on top)
        z_top = 0.0
        paleo_tops: dict[int, float] = {}

        for i in reversed(active_indices):  # youngest first — sits at surface (z_top = 0)
            f = valid[i]
            lp = _litho(f)
            c_m = lp.compaction_coeff / 1000.0
            bm = solid_m[i]
            initial_guess = f.current_base_m - f.current_top_m
            thickness = _layer_thickness_at_depth(bm, lp.porosity_surface, c_m, z_top, initial_guess)
            paleo_tops[i] = z_top
            z_top += thickness

        # Depth offset: water depth of shallowest active layer + eustatic sea level
        shallowest = valid[active_indices[-1]]
        wd = shallowest.water_depth_m
        sl = _sea_level_at(t_ma, sea_level_curve) if sea_level_curve else 0.0
        offset = wd + sl

        for i in active_indices:
            results[i].burial_path.append(BurialPoint(age_ma=t_ma, depth_m=paleo_tops[i] + offset))

    # Sort burial paths chronologically (oldest → present)
    for r in results:
        r.burial_path.sort(key=lambda p: p.age_ma, reverse=True)

    return results
