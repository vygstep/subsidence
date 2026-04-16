import type { TrackConfig } from '@/types'

import { TrackHeader } from './TrackHeader'

const DEPTH_TRACK_WIDTH = 60

interface TrackHeaderRowProps {
  tracks: TrackConfig[]
}

export function TrackHeaderRow({ tracks }: TrackHeaderRowProps) {
  return (
    <div className="track-header-row">
      {/* Spacer that aligns with the DepthTrack canvas */}
      <div className="track-header-row__depth-spacer" style={{ width: DEPTH_TRACK_WIDTH }} />
      {tracks.map((track) => (
        <TrackHeader key={track.id} config={track} width={track.width} />
      ))}
    </div>
  )
}
