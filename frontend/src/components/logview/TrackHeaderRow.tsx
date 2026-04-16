import { useWellDataStore, useViewStore } from '@/stores'
import type { TrackConfig } from '@/types'

import { DEPTH_TRACK_ID, FORMATION_TRACK_ID, TRACK_RESIZE_HANDLE_WIDTH } from './TrackResizeHandle'
import { TrackHeader } from './TrackHeader'

const DEFAULT_DEPTH_TRACK_WIDTH = 60
const DEFAULT_FORMATION_COLUMN_WIDTH = 80

interface TrackHeaderRowProps {
  tracks: TrackConfig[]
}

export function TrackHeaderRow({ tracks }: TrackHeaderRowProps) {
  const trackWidths = useViewStore((state) => state.trackWidths)
  const depthReference = useWellDataStore((state) => state.well?.depth_reference ?? 'MD')
  const depthWidth = trackWidths[DEPTH_TRACK_ID] ?? DEFAULT_DEPTH_TRACK_WIDTH
  const formationWidth = trackWidths[FORMATION_TRACK_ID] ?? DEFAULT_FORMATION_COLUMN_WIDTH

  return (
    <div className="track-header-row">
      <div className="track-header-row__depth-header" style={{ width: depthWidth }}>
        {depthReference}
      </div>
      <div
        className="track-header-row__resize-spacer"
        style={{ width: TRACK_RESIZE_HANDLE_WIDTH }}
        aria-hidden="true"
      />
      {tracks.map((track) => (
        <div key={track.id} className="track-header-row__track-group">
          <TrackHeader config={track} width={trackWidths[track.id] ?? track.width} />
          <div
            className="track-header-row__resize-spacer"
            style={{ width: TRACK_RESIZE_HANDLE_WIDTH }}
            aria-hidden="true"
          />
        </div>
      ))}
      <div className="track-header-row__formation-header" style={{ width: formationWidth }}>
        Formations
      </div>
      <div
        className="track-header-row__resize-spacer"
        style={{ width: TRACK_RESIZE_HANDLE_WIDTH }}
        aria-hidden="true"
      />
    </div>
  )
}
