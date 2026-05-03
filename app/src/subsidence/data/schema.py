from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import MetaData

SUBSIDENCE_APP_ID = 0x53554253  # "SUBS" as 4-byte int
SCHEMA_VERSION = 14

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
    color_hex: Mapped[str | None] = mapped_column(String(9), nullable=True)
    source_las_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON blob
    depth_unit: Mapped[str] = mapped_column(String(4), default='m', server_default='m')
    # unit of depth values stored for this well: 'm' | 'ft' | 'km'

    curve_metadata: Mapped[list[CurveMetadata]] = relationship(
        back_populates="well", cascade="all, delete-orphan"
    )
    deviation_survey: Mapped[DeviationSurveyModel | None] = relationship(
        back_populates="well", cascade="all, delete-orphan", uselist=False
    )
    formation_tops: Mapped[list[FormationTopModel]] = relationship(
        back_populates="well", cascade="all, delete-orphan"
    )
    active_top_set: Mapped["WellActiveTopSet | None"] = relationship(
        "WellActiveTopSet",
        back_populates="well",
        uselist=False,
        cascade="all, delete-orphan",
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
    curve_type: Mapped[str] = mapped_column(String(24), default="continuous")
    # "continuous" — float measurements (GR, ILD, RHOB, …)
    # "discrete"   — integer codes with label map; if lithology_set_id is set, renders as lithology blocks
    depth_min: Mapped[float] = mapped_column(Float)
    depth_max: Mapped[float] = mapped_column(Float)
    n_samples: Mapped[int] = mapped_column(Integer)
    data_uri: Mapped[str] = mapped_column(Text)  # relative path to Parquet
    source_hash: Mapped[str] = mapped_column(String(64))  # sha256 of source file
    null_value: Mapped[float] = mapped_column(Float, default=-999.25)
    discrete_code_map: Mapped[str | None] = mapped_column(Text, nullable=True)
    # curve_type='discrete': JSON {"1": "Sandstone", "2": "Shale"}  (int → display label or lithology_code)
    lithology_set_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("lithology_sets.id"), nullable=True
    )
    # Optional: links the curve to a LithologySet for populating the code-map UI
    trusted_depth_reference: Mapped[str] = mapped_column(String(8), default="MD")
    # "MD" | "TVD" | "TVDSS" — depth type used in the source file
    sampling_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # "CONSTANT" | "VARIABLE" | "SINGLE_POINT" | "UNKNOWN" | NULL (unknown/not computed)
    nominal_step_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    # median depth step for CONSTANT curves, meters; NULL for VARIABLE / SINGLE_POINT
    qc_status: Mapped[str] = mapped_column(String(8), default="OK")
    # "OK" | "WARNING" | "ERROR"
    qc_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON blob: {flags, messages, stats}

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
    depth_unit: Mapped[str] = mapped_column(String(4), default='m', server_default='m')
    # unit of depth values stored in the survey: 'm' | 'ft' | 'km'

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
# 7. top_sets + top_set_horizons + well_active_top_sets
# ---------------------------------------------------------------------------

class TopSet(Base, AuditMixin):
    __tablename__ = "top_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    horizons: Mapped[list["TopSetHorizon"]] = relationship(
        back_populates="top_set", cascade="all, delete-orphan",
        order_by="TopSetHorizon.sort_order",
    )
    active_for_wells: Mapped[list["WellActiveTopSet"]] = relationship(
        back_populates="top_set",
    )
    zones: Mapped[list["FormationZone"]] = relationship(
        back_populates="top_set", cascade="all, delete-orphan",
        order_by="FormationZone.sort_order",
    )


class TopSetHorizon(Base, AuditMixin):
    __tablename__ = "top_set_horizons"
    __table_args__ = (UniqueConstraint("top_set_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    top_set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("top_sets.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(256))
    kind: Mapped[str] = mapped_column(String(16), default="strat")
    # "strat" | "unconformity"
    age_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    color: Mapped[str] = mapped_column(String(9), default="#90a4ae")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    top_set: Mapped[TopSet] = relationship(back_populates="horizons")


class WellActiveTopSet(Base):
    __tablename__ = "well_active_top_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    top_set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("top_sets.id", ondelete="RESTRICT"), nullable=False
    )

    top_set: Mapped[TopSet] = relationship(back_populates="active_for_wells")
    well: Mapped["WellModel"] = relationship(back_populates="active_top_set")


# ---------------------------------------------------------------------------
# 8. formation_tops
# ---------------------------------------------------------------------------

class FormationTopModel(Base, AuditMixin):
    __tablename__ = "formation_tops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id"), nullable=False
    )
    horizon_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("top_set_horizons.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(256))
    kind: Mapped[str] = mapped_column(String(16), default="strat")
    # "strat"        — conformable formation top
    # "unconformity" — erosional boundary; carries hiatus duration
    depth_md: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth_tvd: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth_tvdss: Mapped[float | None] = mapped_column(Float, nullable=True)
    age_top_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    # age of this pick; for unconformity this is the erosion surface age
    age_base_ma: Mapped[float | None] = mapped_column(Float, nullable=True)
    # strat only: optional age at interval base; unconformity base age is derived
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    color: Mapped[str] = mapped_column(String(9), default="#90a4ae")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    water_depth_m: Mapped[float] = mapped_column(Float, default=0.0, server_default='0.0')
    # paleobathymetry + sea level at time of deposition for this interval (m)
    hiatus_duration_ma: Mapped[float] = mapped_column(Float, default=0.0, server_default='0.0')
    # unconformity only: missing time at this erosion surface (Ma)
    eroded_thickness_m: Mapped[float] = mapped_column(Float, default=0.0, server_default='0.0')
    # compacted thickness of section eroded above this boundary (unconformity only, m)
    lithology: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    qc_status: Mapped[str] = mapped_column(String(8), default="OK")
    # "OK" | "WARNING" | "ERROR"
    qc_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON blob: {flags, messages}

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
# 8b. curve_mnemonic_sets + curve_mnemonic_entries
# ---------------------------------------------------------------------------

class CurveMnemonicSet(Base, AuditMixin):
    __tablename__ = "curve_mnemonic_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    entries: Mapped[list["CurveMnemonicEntry"]] = relationship(
        back_populates="mnemonic_set", cascade="all, delete-orphan"
    )


class CurveMnemonicEntry(Base, AuditMixin):
    __tablename__ = "curve_mnemonic_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("curve_mnemonic_sets.id", ondelete="CASCADE"), nullable=False
    )
    pattern: Mapped[str] = mapped_column(String(128))
    is_regex: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    family_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    canonical_mnemonic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    canonical_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    mnemonic_set: Mapped["CurveMnemonicSet"] = relationship(back_populates="entries")


# ---------------------------------------------------------------------------
# 8c. unit_dimensions + measurement_units + measurement_unit_aliases
# ---------------------------------------------------------------------------

class UnitDimension(Base, AuditMixin):
    __tablename__ = "unit_dimensions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    engine_unit_code: Mapped[str] = mapped_column(String(64))
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    units: Mapped[list["MeasurementUnit"]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan"
    )


class MeasurementUnit(Base, AuditMixin):
    __tablename__ = "measurement_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    dimension_code: Mapped[str] = mapped_column(
        String(64), ForeignKey("unit_dimensions.code", ondelete="CASCADE"), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(32))
    display_name: Mapped[str] = mapped_column(String(128))
    to_engine_factor: Mapped[float] = mapped_column(Float, default=1.0)
    to_engine_offset: Mapped[float] = mapped_column(Float, default=0.0)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    dimension: Mapped[UnitDimension] = relationship(back_populates="units")
    aliases: Mapped[list["MeasurementUnitAlias"]] = relationship(
        back_populates="unit", cascade="all, delete-orphan"
    )


class MeasurementUnitAlias(Base, AuditMixin):
    __tablename__ = "measurement_unit_aliases"
    __table_args__ = (
        UniqueConstraint("dimension_code", "normalized_alias", name="uq_measurement_unit_aliases_dimension_alias"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dimension_code: Mapped[str] = mapped_column(
        String(64), ForeignKey("unit_dimensions.code", ondelete="CASCADE"), nullable=False
    )
    unit_code: Mapped[str] = mapped_column(
        String(64), ForeignKey("measurement_units.code", ondelete="CASCADE"), nullable=False
    )
    alias: Mapped[str] = mapped_column(String(64))
    normalized_alias: Mapped[str] = mapped_column(String(64))
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    dimension: Mapped[UnitDimension] = relationship()
    unit: Mapped[MeasurementUnit] = relationship(back_populates="aliases")


# ---------------------------------------------------------------------------
# 8d. lithology_pattern_palettes + lithology_patterns
# ---------------------------------------------------------------------------

class LithologyPatternPalette(Base, AuditMixin):
    __tablename__ = "lithology_pattern_palettes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    origin: Mapped[str] = mapped_column(String(32), default="user")
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    license_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    patterns: Mapped[list["LithologyPattern"]] = relationship(
        back_populates="palette", cascade="all, delete-orphan"
    )


class LithologyPattern(Base, AuditMixin):
    __tablename__ = "lithology_patterns"
    __table_args__ = (
        UniqueConstraint("palette_id", "code", name="uq_lithology_patterns_palette_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    palette_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lithology_pattern_palettes.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(128))
    svg_content: Mapped[str] = mapped_column(Text)
    source_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    tile_width: Mapped[int] = mapped_column(Integer, default=64)
    tile_height: Mapped[int] = mapped_column(Integer, default=64)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    group_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    base_lithology_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    palette: Mapped["LithologyPatternPalette"] = relationship(back_populates="patterns")


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
# 10. lithology_sets + lithology_set_entries
# ---------------------------------------------------------------------------

class LithologySet(Base, AuditMixin):
    __tablename__ = "lithology_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)

    entries: Mapped[list["LithologySetEntry"]] = relationship(
        back_populates="set", cascade="all, delete-orphan"
    )


class LithologySetEntry(Base, AuditMixin):
    __tablename__ = "lithology_set_entries"
    __table_args__ = (UniqueConstraint("set_id", "lithology_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lithology_sets.id", ondelete="CASCADE"), nullable=False
    )
    lithology_code: Mapped[str] = mapped_column(String(64))
    display_name: Mapped[str] = mapped_column(String(128))
    color_hex: Mapped[str] = mapped_column(String(9))
    pattern_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    compaction_preset_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("compaction_presets.id"), nullable=True
    )

    set: Mapped["LithologySet"] = relationship(back_populates="entries")
    compaction_preset: Mapped["CompactionPreset | None"] = relationship()


# ---------------------------------------------------------------------------
# 11. compaction_presets
# ---------------------------------------------------------------------------

class CompactionPreset(Base, AuditMixin):
    __tablename__ = "compaction_presets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    origin: Mapped[str] = mapped_column(String(16), default="user")
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    source_lithology_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    density: Mapped[float] = mapped_column(Float, default=2650.0)
    porosity_surface: Mapped[float] = mapped_column(Float, default=0.50)
    compaction_coeff: Mapped[float] = mapped_column(Float, default=0.30)


# ---------------------------------------------------------------------------
# 12. compaction_models + compaction_model_params
# ---------------------------------------------------------------------------

class CompactionModel(Base):
    __tablename__ = "compaction_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), unique=True)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    params: Mapped[list["CompactionModelParam"]] = relationship(
        back_populates="model", cascade="all, delete-orphan"
    )


class CompactionModelParam(Base):
    __tablename__ = "compaction_model_params"
    __table_args__ = (UniqueConstraint("model_id", "lithology_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("compaction_models.id", ondelete="CASCADE"), nullable=False
    )
    lithology_code: Mapped[str] = mapped_column(String(32), nullable=False)
    density: Mapped[float] = mapped_column(Float, default=2650.0)
    porosity_surface: Mapped[float] = mapped_column(Float, default=0.50)
    compaction_coeff: Mapped[float] = mapped_column(Float, default=0.30)

    model: Mapped[CompactionModel] = relationship(back_populates="params")


# ---------------------------------------------------------------------------
# 13. calculation_results
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
# 14. visual_config
# ---------------------------------------------------------------------------

class VisualConfig(Base, AuditMixin):
    __tablename__ = "visual_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(16))
    # "project" | "well" | "session"
    scope_id: Mapped[str] = mapped_column(String(36))
    config: Mapped[str] = mapped_column(Text)  # JSON blob


# ---------------------------------------------------------------------------
# 15. checkpoints
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
# 15. formation_strat_links
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


# ---------------------------------------------------------------------------
# 16. formation_zones + zone_well_data
# ---------------------------------------------------------------------------

class FormationZone(Base):
    __tablename__ = "formation_zones"
    __table_args__ = (UniqueConstraint("top_set_id", "upper_horizon_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    top_set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("top_sets.id", ondelete="CASCADE"), nullable=False
    )
    upper_horizon_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("top_set_horizons.id", ondelete="RESTRICT"), nullable=False
    )
    lower_horizon_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("top_set_horizons.id", ondelete="RESTRICT"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    top_set: Mapped["TopSet"] = relationship(back_populates="zones")
    upper_horizon: Mapped["TopSetHorizon"] = relationship(foreign_keys=[upper_horizon_id])
    lower_horizon: Mapped["TopSetHorizon"] = relationship(foreign_keys=[lower_horizon_id])
    well_data: Mapped[list["ZoneWellData"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan"
    )


class ZoneWellData(Base):
    __tablename__ = "zone_well_data"
    __table_args__ = (UniqueConstraint("zone_id", "well_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("formation_zones.id", ondelete="CASCADE"), nullable=False
    )
    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id", ondelete="CASCADE"), nullable=False
    )
    thickness_md: Mapped[float | None] = mapped_column(Float, nullable=True)
    thickness_tvd: Mapped[float | None] = mapped_column(Float, nullable=True)
    lithology_fractions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON {"sandstone": 0.6, "shale": 0.4}
    lithology_source: Mapped[str] = mapped_column(String(8), default="auto")
    # "manual" | "auto"

    zone: Mapped["FormationZone"] = relationship(back_populates="well_data")


class SeaLevelCurve(Base, AuditMixin):
    __tablename__ = "sea_level_curves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    source: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)

    points: Mapped[list["SeaLevelPoint"]] = relationship(
        back_populates="curve", cascade="all, delete-orphan"
    )


class SeaLevelPoint(Base):
    __tablename__ = "sea_level_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    curve_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sea_level_curves.id", ondelete="CASCADE"), nullable=False
    )
    age_ma: Mapped[float] = mapped_column(Float, nullable=False)
    sea_level_m: Mapped[float] = mapped_column(Float, nullable=False)

    curve: Mapped["SeaLevelCurve"] = relationship(back_populates="points")


class WellActiveSeaLevelCurve(Base):
    __tablename__ = "well_active_sea_level_curves"

    well_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wells.id", ondelete="CASCADE"), primary_key=True
    )
    curve_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sea_level_curves.id", ondelete="RESTRICT"), nullable=False
    )
