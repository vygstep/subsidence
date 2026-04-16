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
        <span className="curve-scale-bar__line" style={{ background: curve.color }} />
        <span className="curve-scale-bar__mnemonic">{curve.mnemonic}</span>
        {curve.unit && <span className="curve-scale-bar__unit">{curve.unit}</span>}
        <span className="curve-scale-bar__line" style={{ background: curve.color }} />
      </div>
      <div className="curve-scale-bar__range" style={{ color: curve.color }}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
