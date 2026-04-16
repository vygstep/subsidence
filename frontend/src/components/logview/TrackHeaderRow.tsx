import type { TrackConfig } from '@/types'

import { TrackHeader } from './TrackHeader'

const DEPTH_TRACK_WIDTH = 60
const FORMATION_COLUMN_WIDTH = 80

interface TrackHeaderRowProps {
  tracks: TrackConfig[]
}

export function TrackHeaderRow({ tracks }: TrackHeaderRowProps) {
  return (
    <div className="track-header-row">
      <div className="track-header-row__depth-spacer" style={{ width: DEPTH_TRACK_WIDTH }} />
      {tracks.map((track) => (
        <TrackHeader key={track.id} config={track} width={track.width} />
      ))}
      <div className="track-header-row__formation-header" style={{ width: FORMATION_COLUMN_WIDTH }}>
        Formations
      </div>
    </div>
  )
}
