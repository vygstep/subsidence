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
class FormationInput:
    name: str
    color: str           # hex color for display (from LithologyDictEntry or formation itself)
    lithology: str       # lithology_code key into litho_params
    age_top_ma: float    # age at formation top (younger boundary, Ma)
    age_base_ma: float   # age at formation base (older boundary, Ma)
    current_top_m: float
    current_base_m: float


@dataclass
class LithologyParam:
    density: float           # grain density, kg/m³
    porosity_surface: float  # φ₀, fraction 0–1
    compaction_coeff: float  # c, km⁻¹ — converted to m⁻¹ inside engine


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
# Backstripping
# ---------------------------------------------------------------------------

def backstrip(
    formations: list[FormationInput],
    litho_params: dict[str, LithologyParam],
    water_depth_m: float = 0.0,
) -> list[SubsidenceResult]:
    """
    Airy backstripping with Athy decompaction (Stratya2D algorithm pattern).

    Formations without both age_top_ma and age_base_ma are silently skipped.
    Returns one SubsidenceResult per valid formation with a burial_path point
    at each unique formation age step plus the present (age=0).

    Simplified: no sea-level correction (Phase 5).
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

    # Fetch lithology params; fall back to shale defaults if unknown lithology
    _default_litho = LithologyParam(density=2720.0, porosity_surface=0.63, compaction_coeff=0.51)

    def _litho(f: FormationInput) -> LithologyParam:
        return litho_params.get(f.lithology, _default_litho)

    # Pre-compute solid matrix thickness for each formation (conserved quantity)
    solid_m: dict[int, float] = {}
    for i, f in enumerate(valid):
        lp = _litho(f)
        c_m = lp.compaction_coeff / 1000.0
        solid_m[i] = _matrix_thickness(lp.porosity_surface, c_m, f.current_top_m, f.current_base_m)

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

        # Record burial depths (water_depth_m shifts the whole column downward)
        for i in active_indices:
            results[i].burial_path.append(BurialPoint(age_ma=t_ma, depth_m=paleo_tops[i] + water_depth_m))

    # Sort burial paths chronologically (oldest → present)
    for r in results:
        r.burial_path.sort(key=lambda p: p.age_ma, reverse=True)

    return results
