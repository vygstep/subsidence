export interface Well {
  well_id: string
  well_name: string
  kb_elev: number
  td_md: number
  x: number
  y: number
  crs: string
  depth_reference: 'MD' | 'TVD' | 'TVDSS'
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
  is_locked: boolean
  lithology?: LithologyType
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
