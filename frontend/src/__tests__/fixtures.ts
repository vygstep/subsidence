import type { CurveData, FormationTop, TrackConfig, Well } from '@/types'

export function createMockCurveData(overrides?: Partial<CurveData>): CurveData {
  return {
    mnemonic: 'GR',
    unit: 'API',
    depths: new Float32Array([0, 100, 200, 300, 400, 500]),
    values: new Float32Array([20, 40, 50, 60, 70, 80]),
    null_value: -999.25,
    ...overrides,
  }
}

export function createMockFormationTop(overrides?: Partial<FormationTop>): FormationTop {
  return {
    id: 'formation-1',
    name: 'Austin Chalk',
    depth_md: 2000,
    depth_tvd: null,
    depth_tvdss: null,
    horizon_id: null,
    color: '#8B4513',
    kind: 'strat',
    is_locked: false,
    age_ma: 78,
    water_depth_m: 0,
    eroded_thickness_m: 0,
    lithology: 'limestone',
    strat_links: [],
    active_strat_color: null,
    active_strat_unit_name: null,
    ...overrides,
  }
}

export function createMockWell(overrides?: Partial<Well>): Well {
  return {
    well_id: 'well-1',
    well_name: 'Test Well A',
    kb_elev: 100,
    gl_elev: 95,
    td_md: 3000,
    x: 1000000,
    y: 2000000,
    crs: 'EPSG:32619',
    depth_reference: 'MD',
    ...overrides,
  }
}

export function createMockTrackConfig(overrides?: Partial<TrackConfig>): TrackConfig {
  return {
    id: 'track-1',
    title: 'Gamma Ray',
    width: 200,
    curves: [
      {
        mnemonic: 'GR',
        unit: 'API',
        color: '#000000',
        lineWidth: 1.5,
        lineStyle: 'solid',
        scaleMin: 0,
        scaleMax: 150,
        scaleReversed: false,
      },
    ],
    scaleType: 'linear',
    gridDivisions: 10,
    showGrid: true,
    ...overrides,
  }
}

export function createMockFormations(count: number = 3): FormationTop[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFormationTop({
      id: `formation-${i}`,
      name: `Formation ${i}`,
      depth_md: 500 + i * 500,
    }),
  )
}
