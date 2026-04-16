import type { TrackConfig } from '@/types'

import { CurveScaleBar } from './CurveScaleBar'

interface TrackHeaderProps {
  config: TrackConfig
  width: number
}

export function TrackHeader({ config, width }: TrackHeaderProps) {
  return (
    <div className="track-header" style={{ width }}>
      <div className="track-header__title">{config.title}</div>
      {config.curves.map((curve) => (
        <CurveScaleBar key={curve.mnemonic} curve={curve} />
      ))}
    </div>
  )
}
