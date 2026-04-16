export interface TrackConfig {
  id: string
  title: string
  width: number
  curves: CurveConfig[]
  scaleType: 'linear' | 'logarithmic'
  gridDivisions: number
  showGrid: boolean
}

export interface CurveConfig {
  mnemonic: string
  unit?: string
  color: string
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
  scaleMin: number
  scaleMax: number
  scaleReversed: boolean
}
