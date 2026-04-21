from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import MetaData

SUBSIDENCE_APP_ID = 0x53554253  # "SUBS" as 4-byte int
SCHEMA_VERSION = 1

_NAMING: dict[str, str] = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
}


def _now() -> datetime:
    return datetime.now(tz=timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=_NAMING)


# ---------------------------------------------------------------------------
# Audit mixin
# ---------------------------------------------------------------------------

class AuditMixin:
    created_at: Mapped[datetime] = mapped_column(default=_now)
    modified_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)
    created_by: Mapped[str] = mapped_column(String(128), default="local")
    modified_by: Mapped[str] = mapped_column(String(128), default="local")


# ---------------------------------------------------------------------------
# 1. project_meta (singleton)
# ---------------------------------------------------------------------------

class ProjectMeta(Base):
    __tablename__ = "project_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_name: Mapped[str] = mapped_column(String(256))
    app_version: Mapped[str] = mapped_column(String(32))
    schema_version: Mapped[int] = mapped_column(Integer, default=SCHEMA_VERSION)
    project_uuid: Mapped[str] = mapped_column(String(36), unique=True)
    created_at: Mapped[datetime] = mapped_column(default=_now)
    modified_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)


# ---------------------------------------------------------------------------
# 2. users
# ---------------------------------------------------------------------------

class UserModel(Base, AuditMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(256))
    is_local_default: Mapped[bool] = mapped_column(Boolean, default=False)
    server_account_id: Mapped[str | None] = mapped_column(String(256), nullable=True)


# ---------------------------------------------------------------------------
# 3. wells
# ---------------------------------------------------------------------------

class WellModel(Base, AuditMixin):
    __tablename__ = "wells"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uwi: Mapped[str | None] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(256))
    kb_elev: Mapped[float] = mapped_column(Float, default=0.0)
    gl_elev: Mapped[float] = mapped_column(Float, default=0.0)
    td_md: Mapped[float | None] = mapped_column(Float, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    crs: Mapped[str] = mapped_column(String(64), default="unset")
    source_las_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON blob

    curve_metadata: Mapped[list[CurveMetadata]] = relationship(
        back_populates="well", cascade="all, delete-orphan"
    )
    deviation_survey: Mapped[DeviationSurveyModel | None] = relationship(
        back_populates="well", cascade="all, delete-orphan", uselist=False
    )
    formation_tops: Mapped[list[FormationTopModel]] = relationship(
        back_populates="well", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# 4. curve_metadata
# ---------------------------------------------------------------------------

class CurveMetadata(Base, AuditMixin):
    __tablename__ = "curve_metadata"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id"), nullable=False
    )
    mnemonic: Mapped[str] = mapped_column(String(64))
    standard_mnemonic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    family_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    unit: Mapped[str] = mapped_column(String(32), default="")
    original_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    curve_type: Mapped[str] = mapped_column(String(16), default="continuous")
    # "continuous" — float measurements (GR, ILD, RHOB, …)
    # "discrete"   — integer codes (lithofacies, zone flags) — Phase 3+
    depth_min: Mapped[float] = mapped_column(Float)
    depth_max: Mapped[float] = mapped_column(Float)
    n_samples: Mapped[int] = mapped_column(Integer)
    data_uri: Mapped[str] = mapped_column(Text)  # relative path to Parquet
    source_hash: Mapped[str] = mapped_column(String(64))  # sha256 of source file
    null_value: Mapped[float] = mapped_column(Float, default=-999.25)

    well: Mapped[WellModel] = relationship(back_populates="curve_metadata")


# ---------------------------------------------------------------------------
# 5. deviation_surveys
# ---------------------------------------------------------------------------

class DeviationSurveyModel(Base, AuditMixin):
    __tablename__ = "deviation_surveys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id"), nullable=False, unique=True
    )
    reference: Mapped[str] = mapped_column(String(8))   # MD | TVD | TVDSS
    mode: Mapped[str] = mapped_column(String(12))        # INCL_AZIM | X_Y | DX_DY
    data_uri: Mapped[str] = mapped_column(Text)
    source_hash: Mapped[str] = mapped_column(String(64))

    well: Mapped[WellModel] = relationship(back_populates="deviation_survey")


# ---------------------------------------------------------------------------
# 6. strat_charts + strat_units (dictionary)
# ---------------------------------------------------------------------------

class StratChart(Base):
    __tablename__ = "strat_charts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    imported_at: Mapped[datetime] = mapped_column(default=_now)

    units: Mapped[list["StratUnit"]] = relationship(back_populates="chart", cascade="all, delete-orphan")


class StratUnit(Base):
    __tablename__ = "strat_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    rank: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("strat_units.id"), nullable=True
    )
    age_top_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    age_base_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    lithology: Mapped[str | None] = mapped_column(String(32), nullable=True)
    color_hex: Mapped[str | None] = mapped_column(String(9), nullable=True)
    chart_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("strat_charts.id"), nullable=True
    )

    chart: Mapped[StratChart | None] = relationship(back_populates="units")


# ---------------------------------------------------------------------------
# 7. formation_tops
# ---------------------------------------------------------------------------

class FormationTopModel(Base, AuditMixin):
    __tablename__ = "formation_tops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(256))
    kind: Mapped[str] = mapped_column(String(16), default="strat")
    # "strat"        — conformable formation top
    # "unconformity" — erosional boundary; carries hiatus age bounds
    depth_md: Mapped[float] = mapped_column(Float)
    depth_tvd: Mapped[float | None] = mapped_column(Float, nullable=True)
    age_top_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    # strat: age of this pick; unconformity: start of hiatus (younger)
    age_base_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    # unconformity only: base of hiatus (older); gap = age_base_ma - age_top_ma
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    color: Mapped[str] = mapped_column(String(9), default="#90a4ae")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    well: Mapped[WellModel] = relationship(back_populates="formation_tops")
    strat_links: Mapped[list["FormationStratLink"]] = relationship(
        back_populates="formation", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# 8. curve_dict_entries
# ---------------------------------------------------------------------------

class CurveDictEntry(Base, AuditMixin):
    __tablename__ = "curve_dict_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(16), default="base")
    # "base" — shipped with app, read-only by convention
    # "project" — per-project additions / overrides
    # "user" — future per-user layer
    pattern: Mapped[str] = mapped_column(String(128))
    is_regex: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    family_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    canonical_mnemonic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    canonical_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ---------------------------------------------------------------------------
# 9. lithology_dict_entries
# ---------------------------------------------------------------------------

class LithologyDictEntry(Base):
    __tablename__ = "lithology_dict_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lithology_code: Mapped[str] = mapped_column(String(32), unique=True)
    # must match the string literal used in lithologyRenderer.ts
    display_name: Mapped[str] = mapped_column(String(128))
    color_hex: Mapped[str] = mapped_column(String(9))
    pattern_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # null → solid fill; matches lithology_code for entries that have a canvas pattern
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # Compaction parameters (Athy model: φ(z) = φ₀·exp(−c·z))
    density: Mapped[float] = mapped_column(Float, default=2650.0)
    # grain (matrix) density in kg/m³
    porosity_surface: Mapped[float] = mapped_column(Float, default=0.50)
    # φ₀, surface porosity (unitless fraction 0–1)
    compaction_coeff: Mapped[float] = mapped_column(Float, default=0.30)
    # c in km⁻¹; engine converts to m⁻¹ via c_m = c_km / 1000.0


# ---------------------------------------------------------------------------
# 10. calculation_results
# ---------------------------------------------------------------------------

class CalculationResult(Base, AuditMixin):
    __tablename__ = "calculation_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("wells.id"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(64))       # "burial_history", "subsidence"
    algorithm: Mapped[str] = mapped_column(String(64))  # "airy_backstrip", …
    params_json: Mapped[str] = mapped_column(Text)
    inputs_hash: Mapped[str] = mapped_column(String(64))
    data_uri: Mapped[str] = mapped_column(Text)
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False)


# ---------------------------------------------------------------------------
# 11. visual_config
# ---------------------------------------------------------------------------

class VisualConfig(Base, AuditMixin):
    __tablename__ = "visual_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(16))
    # "project" | "well" | "session"
    scope_id: Mapped[str] = mapped_column(String(36))
    config: Mapped[str] = mapped_column(Text)  # JSON blob


# ---------------------------------------------------------------------------
# 12. checkpoints
# ---------------------------------------------------------------------------

class CheckpointModel(Base):
    __tablename__ = "checkpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[datetime] = mapped_column(default=_now)
    file_path: Mapped[str] = mapped_column(Text)   # relative to project bundle root
    byte_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    app_version: Mapped[str] = mapped_column(String(32))
    schema_version: Mapped[int] = mapped_column(Integer)


# ---------------------------------------------------------------------------
# 13. formation_strat_links
# ---------------------------------------------------------------------------

class FormationStratLink(Base):
    __tablename__ = "formation_strat_links"
    __table_args__ = (UniqueConstraint("formation_id", "chart_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("formation_tops.id", ondelete="CASCADE"), nullable=False
    )
    strat_unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strat_units.id", ondelete="CASCADE"), nullable=False
    )
    chart_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strat_charts.id", ondelete="CASCADE"), nullable=False
    )

    formation: Mapped[FormationTopModel] = relationship(back_populates="strat_links")
    strat_unit: Mapped[StratUnit] = relationship()
    chart: Mapped[StratChart] = relationship()
