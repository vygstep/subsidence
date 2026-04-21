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
