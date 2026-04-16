import type { CurveConfig } from '@/types'

interface CurveScaleBarProps {
  curve: CurveConfig
}

export function CurveScaleBar({ curve }: CurveScaleBarProps) {
  const left = curve.scaleReversed ? curve.scaleMax : curve.scaleMin
  const right = curve.scaleReversed ? curve.scaleMin : curve.scaleMax

  return (
    <div className="curve-scale-bar">
      <div className="curve-scale-bar__header">
        <span className="curve-scale-bar__swatch" style={{ background: curve.color }} />
        <span className="curve-scale-bar__mnemonic">{curve.mnemonic}</span>
        <span className="curve-scale-bar__unit">{curve.unit}</span>
      </div>
      <div className="curve-scale-bar__range" style={{ color: curve.color }}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
