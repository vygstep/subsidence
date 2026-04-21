import type { CurveData } from '@/types'

interface CurveTooltipProps {
  x: number
  y: number
  depth: number
  curves: CurveData[]
  visible: boolean
}

function bisectLeft(arr: Float32Array, target: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function interpolateAtDepth(depths: Float32Array, values: Float32Array, target: number): number | null {
  const idx = bisectLeft(depths, target)
  if (idx === 0 || idx >= depths.length) return null
  const t = (target - depths[idx - 1]) / (depths[idx] - depths[idx - 1])
  return values[idx - 1] + t * (values[idx] - values[idx - 1])
}

export function CurveTooltip({ x, y, depth, curves, visible }: CurveTooltipProps) {
  if (!visible || curves.length === 0) return null

  const rows = curves
    .map((curve) => {
      const value = interpolateAtDepth(curve.depths, curve.values, depth)
      return value !== null && Number.isFinite(value)
        ? { mnemonic: curve.mnemonic, unit: curve.unit, value }
        : null
    })
    .filter((row): row is { mnemonic: string; unit: string; value: number } => row !== null)

  if (rows.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 12,
        top: y + 4,
        zIndex: 50,
        background: 'rgba(15,23,42,0.88)',
        color: '#f1f5f9',
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: 11,
        lineHeight: '18px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {rows.map(({ mnemonic, unit, value }) => (
        <div key={mnemonic}>
          <span style={{ opacity: 0.6, marginRight: 4 }}>{mnemonic}</span>
          {value.toFixed(2)}
          {unit ? <span style={{ opacity: 0.5, marginLeft: 2 }}>{unit}</span> : null}
        </div>
      ))}
    </div>
  )
}
