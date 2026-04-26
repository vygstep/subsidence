export interface BurialPoint {
  age_ma: number
  depth_m: number
}

export interface SubsidenceResult {
  formation_name: string
  color: string
  lithology: string
  burial_path: BurialPoint[]
}

export interface LithologyParam {
  lithology_code: string
  display_name: string
  color_hex: string
  density: number
  porosity_surface: number
  compaction_coeff: number
}

export interface CompactionModel {
  id: number
  name: string
  is_builtin: boolean
  is_active: boolean
}

export type CompactionPresetOrigin = 'builtin' | 'user'

export interface CompactionPresetSummary {
  id: number
  name: string
  origin: CompactionPresetOrigin | string
  is_builtin: boolean
  source_lithology_code: string | null
}

export interface CompactionPresetDetail extends CompactionPresetSummary {
  description: string | null
  density: number
  porosity_surface: number
  compaction_coeff: number
}

export interface CurveMnemonicSetSummary {
  id: number
  name: string
  is_builtin: boolean
  entry_count: number
}

export interface CurveMnemonicEntryItem {
  id: number
  pattern: string
  is_regex: boolean
  priority: number
  family_code: string | null
  canonical_mnemonic: string | null
  canonical_unit: string | null
  is_active: boolean
}

export interface CurveMnemonicSetDetail extends CurveMnemonicSetSummary {
  entries: CurveMnemonicEntryItem[]
}

export interface MeasurementUnitAliasItem {
  id: number
  dimension_code: string
  unit_code: string
  alias: string
  normalized_alias: string
  is_builtin: boolean
  is_active: boolean
}

export interface MeasurementUnitItem {
  id: number
  code: string
  dimension_code: string
  symbol: string
  display_name: string
  to_engine_factor: number
  to_engine_offset: number
  is_builtin: boolean
  is_active: boolean
  sort_order: number
  aliases: MeasurementUnitAliasItem[]
}

export interface UnitDimensionSummary {
  id: number
  code: string
  display_name: string
  description: string | null
  engine_unit_code: string
  is_builtin: boolean
  sort_order: number
  unit_count: number
  alias_count: number
}

export interface UnitDimensionDetail extends UnitDimensionSummary {
  units: MeasurementUnitItem[]
}

export interface LithologyDictionaryEntry {
  id: number
  lithology_code: string
  display_name: string
  color_hex: string
  pattern_id: string | null
  description: string | null
  sort_order: number
  density: number
  porosity_surface: number
  compaction_coeff: number
}

export interface LithologySetSummary {
  id: number
  name: string
  is_builtin: boolean
  entry_count: number
}

export interface LithologySetEntry {
  id: number
  lithology_code: string
  display_name: string
  color_hex: string
  pattern_id: string | null
  sort_order: number
  compaction_preset_id: number | null
  compaction_preset_label: string | null
  density: number | null
  porosity_surface: number | null
  compaction_coeff: number | null
}

export interface LithologySetDetail extends LithologySetSummary {
  entries: LithologySetEntry[]
}

export interface LithologyPatternPaletteSummary {
  id: number
  name: string
  origin: string
  is_builtin: boolean
  source_url: string | null
  license_name: string | null
  entry_count: number
}

export interface LithologyPatternEntry {
  id: number
  palette_id: number
  code: string
  display_name: string
  svg_content: string
  source_code: string | null
  source_name: string | null
  source_path: string | null
  tile_width: number
  tile_height: number
  description: string | null
  sort_order: number
}

export interface LithologyPatternPaletteDetail extends LithologyPatternPaletteSummary {
  description: string | null
  patterns: LithologyPatternEntry[]
}

export interface TopSetHorizon {
  id: number
  name: string
  kind: string
  age_ma: number | null
  color: string
  sort_order: number
  note: string | null
}

export interface TopSetSummary {
  id: number
  name: string
  description: string | null
  horizon_count: number
}

export interface TopSetDetail {
  id: number
  name: string
  description: string | null
  horizons: TopSetHorizon[]
}
