import type { CurveData, CurveConfig, TrackConfig } from '@/types'

const FALLBACK_TRACK_COLORS = ['#22c55e', '#ef4444', '#2563eb', '#f59e0b', '#8b5cf6', '#0f766e', '#dc2626', '#475569']

type CurveScaleType = TrackConfig['scaleType']
type CurveLineStyle = CurveConfig['lineStyle']

interface CurveVisualPreset {
  mnemonics: string[]
  color: string
  lineWidth: number
  lineStyle: CurveLineStyle
  scaleType: CurveScaleType
  scaleReversed?: boolean
  scaleMin?: number
  scaleMax?: number
}

const CURVE_VISUAL_PRESETS: CurveVisualPreset[] = [
  {
    mnemonics: ['GR', 'GAMMA', 'GAMMA_RAY'],
    color: '#2e7d32',
    lineWidth: 1.6,
    lineStyle: 'solid',
    scaleType: 'linear',
    scaleMin: 0,
    scaleMax: 150,
  },
  {
    mnemonics: ['SP'],
    color: '#6d4c41',
    lineWidth: 1.4,
    lineStyle: 'solid',
    scaleType: 'linear',
    scaleMin: -100,
    scaleMax: 100,
  },
  {
    mnemonics: ['CALI', 'CALI1', 'CAL', 'HCAL'],
    color: '#455a64',
    lineWidth: 1.4,
    lineStyle: 'dashed',
    scaleType: 'linear',
    scaleMin: 6,
    scaleMax: 16,
  },
  {
    mnemonics: ['DT', 'DTC', 'AC'],
    color: '#1e88e5',
    lineWidth: 1.6,
    lineStyle: 'solid',
    scaleType: 'linear',
    scaleReversed: true,
    scaleMin: 40,
    scaleMax: 140,
  },
  {
    mnemonics: ['RHOB', 'RHOZ', 'DEN'],
    color: '#8e24aa',
    lineWidth: 1.6,
    lineStyle: 'solid',
    scaleType: 'linear',
    scaleReversed: true,
    scaleMin: 1.95,
    scaleMax: 2.95,
  },
  {
    mnemonics: ['NPHI', 'NPHI_LS', 'TNPH'],
    color: '#ef6c00',
    lineWidth: 1.6,
    lineStyle: 'solid',
    scaleType: 'linear',
    scaleReversed: true,
    scaleMin: -0.15,
    scaleMax: 0.45,
  },
  {
    mnemonics: ['PEF', 'PE'],
    color: '#3949ab',
    lineWidth: 1.4,
    lineStyle: 'solid',
    scaleType: 'linear',
    scaleMin: 0,
    scaleMax: 10,
  },
  {
    mnemonics: ['RT', 'ILD', 'ILM', 'AT90', 'RESD', 'RESD', 'RDEP', 'LLD', 'LLS', 'MSFL'],
    color: '#c62828',
    lineWidth: 1.6,
    lineStyle: 'solid',
    scaleType: 'logarithmic',
    scaleMin: 0.2,
    scaleMax: 2000,
  },
]

function normalizeMnemonic(value: string): string {
  return value.trim().toUpperCase()
}

function computeCurveBounds(values: Float32Array, nullValue: number) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value) || value === nullValue) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const fallback = Number.isFinite(min) ? min : 0
    return { min: fallback, max: fallback + 1 }
  }
  return { min, max }
}

function presetForMnemonic(mnemonic: string): CurveVisualPreset | null {
  const normalized = normalizeMnemonic(mnemonic)
  return CURVE_VISUAL_PRESETS.find((preset) => preset.mnemonics.includes(normalized)) ?? null
}

export function buildCurveDefaults(
  curve: CurveData,
  fallbackIndex = 0,
): { curveConfig: CurveConfig; scaleType: CurveScaleType } {
  const preset = presetForMnemonic(curve.mnemonic)
  const bounds = computeCurveBounds(curve.values, curve.null_value)

  const scaleMin = preset?.scaleMin ?? bounds.min
  const scaleMax = preset?.scaleMax ?? bounds.max
  const safeScaleMin = preset?.scaleType === 'logarithmic' ? Math.max(scaleMin, 0.1) : scaleMin
  const safeScaleMax = preset?.scaleType === 'logarithmic' ? Math.max(scaleMax, safeScaleMin * 10) : scaleMax

  return {
    curveConfig: {
      mnemonic: curve.mnemonic,
      unit: curve.unit,
      color: preset?.color ?? FALLBACK_TRACK_COLORS[fallbackIndex % FALLBACK_TRACK_COLORS.length],
      lineWidth: preset?.lineWidth ?? 1.5,
      lineStyle: preset?.lineStyle ?? 'solid',
      scaleMin: safeScaleMin,
      scaleMax: safeScaleMax,
      scaleReversed: preset?.scaleReversed ?? false,
      curve_type: curve.curve_type ?? 'continuous',
    },
    scaleType: preset?.scaleType ?? 'linear',
  }
}
