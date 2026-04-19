export interface Well {
  well_id: string
  well_name: string
  kb_elev: number
  gl_elev: number
  td_md: number
  x: number
  y: number
  crs: string
  depth_reference: 'MD' | 'TVD' | 'TVDSS'
  source_las_path?: string | null
  deviation?: {
    reference: string
    mode: string
    fields: string[]
  } | null
}

export interface CurveData {
  mnemonic: string
  unit: string
  depths: Float32Array
  values: Float32Array
  null_value: number
}

export interface FormationTop {
  id: string
  name: string
  depth_md: number
  age_ma?: number
  color: string
  kind: string
  strat_color?: string | null
  is_locked: boolean
  lithology?: LithologyType
  strat_unit_id?: number | null
  strat_unit_name?: string | null
}

export interface StratUnitOption {
  id: number
  name: string
  rank?: string | null
  color_hex?: string | null
}

export type LithologyType =
  | 'sandstone'
  | 'shale'
  | 'limestone'
  | 'dolomite'
  | 'evaporite'
  | 'igneous'
  | 'metamorphic'
  | 'coal'
  | 'conglomerate'
