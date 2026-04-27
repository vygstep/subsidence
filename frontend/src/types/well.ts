export interface Well {
  well_id: string
  well_name: string
  kb_elev: number
  gl_elev: number
  td_md: number
  x: number
  y: number
  coordinate_semantics?: 'project_xy'
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
  curve_type: 'continuous' | 'discrete'
  discrete_code_map: Record<string, string> | null
}

export interface CurveInventoryItem {
  mnemonic: string
  unit: string
  trusted_depth_reference?: string
  curve_type?: 'continuous' | 'discrete'
  discrete_code_map?: Record<string, string> | null
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
  depth_md: number | null
  depth_tvd: number | null
  depth_tvdss: number | null
  horizon_id: number | null
  age_ma?: number
  color: string
  kind: string
  is_locked: boolean
  water_depth_m: number
  eroded_thickness_m: number
  lithology?: LithologyType
  strat_links: FormationStratLink[]
  active_strat_color: string | null
  active_strat_unit_name: string | null
}

export interface FormationInventoryItem {
  id: string
  name: string
  depth_md: number | null
  depth_tvd: number | null
  depth_tvdss: number | null
  horizon_id: number | null
  active_strat_color: string | null
}

export interface StratChartInfo {
  id: number
  name: string
  is_active: boolean
  is_builtin: boolean
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

export interface ZoneHorizonRef {
  id: number
  name: string
  age_ma: number | null
}

export interface FormationZone {
  zone_id: number
  top_set_id: number
  upper_horizon: ZoneHorizonRef
  lower_horizon: ZoneHorizonRef
  sort_order: number
  thickness_md: number | null
  thickness_tvd: number | null
  age_span_ma: number | null
  hiatus_ma: number | null
  lithology_fractions: string | null
  lithology_source: 'manual' | 'auto'
  water_depth_m: number
}

export interface SeaLevelCurve {
  id: number
  name: string
  source: string | null
  is_builtin: boolean
  point_count: number
}

export interface WellInventory {
  well_id: string
  well_name: string
  kb_elev: number
  gl_elev: number
  td_md: number
  x: number
  y: number
  coordinate_semantics?: 'project_xy'
  crs: string
  source_las_path?: string | null
  active_top_set_id: number | null
  active_top_set_name: string | null
  active_sea_level_curve_id: number | null
  deviation?: {
    reference: string
    mode: string
    fields: string[]
  } | null
  curves: CurveInventoryItem[]
  formations: FormationInventoryItem[]
  zones: FormationZone[]
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
