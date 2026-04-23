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

export interface CurveDictionaryEntry {
  id: number
  scope: string
  pattern: string
  is_regex: boolean
  priority: number
  family_code: string | null
  canonical_mnemonic: string | null
  canonical_unit: string | null
  is_active: boolean
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
