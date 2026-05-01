from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Mapping, Sequence
from uuid import uuid4


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class DepthReference(str, Enum):
    MD = "MD"
    TVD = "TVD"
    TVDSS = "TVDSS"


class TopKind(str, Enum):
    STRAT = "strat"
    UNCONFORMITY = "unconformity"


class BoundaryType(str, Enum):
    CONFORMABLE = "conformable"
    UNCONFORMITY = "unconformity"


class SurveyMode(str, Enum):
    INCL_AZIM = "INCL_AZIM"
    XY = "X_Y"
    DX_DY = "DX_DY"


# ---------------------------------------------------------------------------
# Well
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WellCreateInput:
    well_name: str
    kb_elev: float = 10.0
    gl_elev: float = 10.0
    td_md: float = 1000.0
    td_tvd: float = 1000.0
    x: float = 0.0
    y: float = 0.0
    crs: str = "unset"

    def validate(self) -> None:
        if not self.well_name.strip():
            raise ValueError("well_name is required")
        if self.td_md <= 0 or self.td_tvd <= 0:
            raise ValueError("td_md and td_tvd must be > 0")


@dataclass(frozen=True)
class Well:
    well_id: str
    well_name: str
    kb_elev: float
    gl_elev: float
    td_md: float
    td_tvd: float
    x: float
    y: float
    crs: str

    @classmethod
    def from_create_input(cls, data: WellCreateInput) -> Well:
        data.validate()
        return cls(
            well_id=str(uuid4()),
            well_name=data.well_name.strip(),
            kb_elev=data.kb_elev,
            gl_elev=data.gl_elev,
            td_md=data.td_md,
            td_tvd=data.td_tvd,
            x=data.x,
            y=data.y,
            crs=data.crs,
        )


# ---------------------------------------------------------------------------
# Curves
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LogCurve:
    mnemonic: str
    unit: str
    depth_ref: DepthReference
    depths: list[float]
    values: list[float]
    null_value: float = -999.25
    standard_mnemonic: str | None = None
    family_code: str | None = None
    original_unit: str | None = None

    def validate(self) -> None:
        if not self.mnemonic.strip():
            raise ValueError("mnemonic is required")
        if len(self.depths) != len(self.values):
            raise ValueError("depths and values must have same length")
        if len(self.depths) < 2:
            raise ValueError("curve must contain at least 2 samples")
        if any(b <= a for a, b in zip(self.depths, self.depths[1:])):
            raise ValueError("depths must be strictly increasing")


# ---------------------------------------------------------------------------
# Stratigraphic chart
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StratRank:
    rank_id: int
    rank_name_en: str
    rank_name_ru: str

    @classmethod
    def from_row(cls, row: Mapping[str, str]) -> StratRank:
        return cls(
            rank_id=int(row["rank_id"]),
            rank_name_en=row["rank_name_en"].strip(),
            rank_name_ru=row["rank_name_ru"].strip(),
        )


@dataclass(frozen=True)
class StratUnit:
    unit_id: int
    parent_unit_id: int | None
    unit_name_en: str
    unit_name_ru: str
    strat_code: str
    rank_id: int | None
    start_age_ma: float | None
    end_age_ma: float | None
    red: int | None
    green: int | None
    blue: int | None
    standard_sort: int | None

    @property
    def color_hex(self) -> str | None:
        if self.red is None or self.green is None or self.blue is None:
            return None
        return f"#{self.red:02X}{self.green:02X}{self.blue:02X}"

    @classmethod
    def from_row(cls, row: Mapping[str, str]) -> StratUnit:
        def _int(name: str) -> int | None:
            v = (row.get(name) or "").strip()
            return int(v) if v else None

        def _float(name: str) -> float | None:
            v = (row.get(name) or "").strip()
            return float(v) if v else None

        return cls(
            unit_id=int(row["unit_id"]),
            parent_unit_id=_int("parent_unit_id"),
            unit_name_en=(row.get("unit_name_en") or "").strip(),
            unit_name_ru=(row.get("unit_name_ru") or "").strip(),
            strat_code=(row.get("strat_code") or "").strip(),
            rank_id=_int("rank_id"),
            start_age_ma=_float("start_age_ma"),
            end_age_ma=_float("end_age_ma"),
            red=_int("red"),
            green=_int("green"),
            blue=_int("blue"),
            standard_sort=_int("standard_sort"),
        )


@dataclass
class StratChart:
    units: list[StratUnit]
    ranks: list[StratRank]

    def validate(self) -> None:
        unit_ids = {u.unit_id for u in self.units}
        for unit in self.units:
            if unit.parent_unit_id is not None and unit.parent_unit_id not in unit_ids:
                raise ValueError(
                    f"Unit {unit.unit_id} points to missing parent {unit.parent_unit_id}"
                )

    @property
    def units_by_id(self) -> dict[int, StratUnit]:
        return {u.unit_id: u for u in self.units}

    @property
    def ranks_by_id(self) -> dict[int, StratRank]:
        return {r.rank_id: r for r in self.ranks}


def make_strat_chart(
    units_rows: Iterable[Mapping[str, str]],
    ranks_rows: Iterable[Mapping[str, str]],
) -> StratChart:
    chart = StratChart(
        units=[StratUnit.from_row(row) for row in units_rows],
        ranks=[StratRank.from_row(row) for row in ranks_rows],
    )
    chart.validate()
    return chart


# ---------------------------------------------------------------------------
# Formation tops
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TopsLoadOptions:
    depth_ref: DepthReference = DepthReference.MD


@dataclass(frozen=True)
class StratTopPick:
    well_name: str
    top_name: str
    depth: float
    strat_age_ma: float | None
    depth_ref: DepthReference
    kind: TopKind = TopKind.STRAT
    boundary_type: BoundaryType = BoundaryType.CONFORMABLE

    def validate(self) -> None:
        if not self.well_name.strip():
            raise ValueError("well_name is required")
        if not self.top_name.strip():
            raise ValueError("top_name is required")


@dataclass(frozen=True)
class UnconformityPick:
    well_name: str
    unc_name: str
    md: float
    start_age_ma: float
    base_age_ma: float
    kind: TopKind = TopKind.UNCONFORMITY

    def validate(self) -> None:
        if not self.well_name.strip():
            raise ValueError("well_name is required")
        if not self.unc_name.strip():
            raise ValueError("unc_name is required")
        if self.base_age_ma < self.start_age_ma:
            raise ValueError("base_age_ma must be >= start_age_ma")


def validate_tops(
    strat_picks: Sequence[StratTopPick],
    unconformities: Sequence[UnconformityPick],
) -> None:
    for pick in strat_picks:
        pick.validate()
    for unconformity in unconformities:
        unconformity.validate()


# ---------------------------------------------------------------------------
# Deviation survey
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DeviationPoint:
    md: float | None = None
    tvd: float | None = None
    tvdss: float | None = None
    incl_deg: float | None = None
    azim_deg: float | None = None
    x: float | None = None
    y: float | None = None
    dx: float | None = None
    dy: float | None = None


@dataclass
class DeviationSurvey:
    reference: DepthReference
    mode: SurveyMode
    points: list[DeviationPoint]

    def validate(self) -> None:
        if not self.points:
            raise ValueError("Deviation survey cannot be empty")

        depth_field = {
            DepthReference.MD: "md",
            DepthReference.TVD: "tvd",
            DepthReference.TVDSS: "tvdss",
        }[self.reference]

        required_fields = {
            SurveyMode.INCL_AZIM: (depth_field, "incl_deg", "azim_deg"),
            SurveyMode.XY: (depth_field, "x", "y"),
            SurveyMode.DX_DY: (depth_field, "dx", "dy"),
        }[self.mode]

        for point in self.points:
            for attr in required_fields:
                if getattr(point, attr) is None:
                    raise ValueError(
                        f"Deviation point missing required field {attr!r} "
                        f"for {self.reference.value}+{self.mode.value}"
                    )

        depth_values = [getattr(p, depth_field) for p in self.points]
        if any(depth_values[i] >= depth_values[i + 1] for i in range(len(depth_values) - 1)):
            raise ValueError(f"{depth_field.upper()} values must be strictly increasing")


def supported_deviation_formats() -> list[tuple[str, tuple[str, ...]]]:
    return [
        ("MD + INCL + AZIM", ("md", "incl_deg", "azim_deg")),
        ("MD + X + Y",       ("md", "x", "y")),
        ("MD + DX + DY",     ("md", "dx", "dy")),
        ("TVD + INCL + AZIM",("tvd", "incl_deg", "azim_deg")),
        ("TVD + X + Y",      ("tvd", "x", "y")),
        ("TVD + DX + DY",    ("tvd", "dx", "dy")),
        ("TVDSS + INCL + AZIM",("tvdss", "incl_deg", "azim_deg")),
        ("TVDSS + X + Y",    ("tvdss", "x", "y")),
        ("TVDSS + DX + DY",  ("tvdss", "dx", "dy")),
    ]
