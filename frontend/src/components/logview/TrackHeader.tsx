import type { TrackConfig } from '@/types'

import { CurveScaleBar } from './CurveScaleBar'

interface TrackHeaderProps {
  config: TrackConfig
  width: number
  isSelected?: boolean
  onSelect?: () => void
}

export function TrackHeader({ config, width, isSelected = false, onSelect }: TrackHeaderProps) {
  return (
    <button type="button" className={`track-header ${isSelected ? 'track-header--selected' : ''}`} style={{ width }} onClick={onSelect}>
      <div className="track-header__title">{config.title}</div>
      {config.curves.map((curve) => (
        <CurveScaleBar key={curve.mnemonic} curve={curve} />
      ))}
    </button>
  )
}
