export interface TrackConfig {
  id: string
  title: string
  width: number
  curves: CurveConfig[]
  scaleType: 'linear' | 'logarithmic'
  gridDivisions: number
  showGrid: boolean
}

export interface CurveFillConfig {
  type: 'to-baseline' | 'crossover'
  baseline?: number
  pairedCurve?: string
  colorPositive: string
  colorNegative: string
  opacity: number
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
  fill?: CurveFillConfig
}
