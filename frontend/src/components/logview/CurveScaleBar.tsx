import type { CurveConfig } from '@/types'

interface CurveScaleBarProps {
  curve: CurveConfig
}

export function CurveScaleBar({ curve }: CurveScaleBarProps) {
  const label = curve.scaleReversed
    ? `${curve.scaleMax} ←——→ ${curve.scaleMin}`
    : `${curve.scaleMin} ←——→ ${curve.scaleMax}`

  return (
    <div className="curve-scale-bar">
      <div className="curve-scale-bar__header">
        <span className="curve-scale-bar__swatch" style={{ background: curve.color }} />
        <span className="curve-scale-bar__mnemonic">{curve.mnemonic}</span>
      </div>
      <div className="curve-scale-bar__range" style={{ color: curve.color }}>
        {label}
      </div>
    </div>
  )
}
