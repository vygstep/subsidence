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

export interface CurveInventoryItem {
  mnemonic: string
  unit: string
}

export interface FormationStratLink {
  chart_id: number
  chart_name: string
  strat_unit_id: number
  strat_unit_name: string
  color_hex: string | null
}

export interface FormationTop {
  id: string
  name: string
  depth_md: number
  age_ma?: number
  color: string
  kind: string
  is_locked: boolean
  lithology?: LithologyType
  strat_links: FormationStratLink[]
  active_strat_color: string | null
  active_strat_unit_name: string | null
}

export interface FormationInventoryItem {
  id: string
  name: string
  depth_md: number
  active_strat_color: string | null
}

export interface StratChartInfo {
  id: number
  name: string
  is_active: boolean
  unit_count: number
  imported_at: string
  source_path: string | null
}

export interface StratUnitOption {
  id: number
  name: string
  rank?: string | null
  color_hex?: string | null
}

export interface WellInventory {
  well_id: string
  well_name: string
  kb_elev: number
  gl_elev: number
  td_md: number
  x: number
  y: number
  crs: string
  source_las_path?: string | null
  deviation?: {
    reference: string
    mode: string
    fields: string[]
  } | null
  curves: CurveInventoryItem[]
  formations: FormationInventoryItem[]
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
