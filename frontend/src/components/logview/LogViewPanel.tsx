import { Fragment, useEffect, useRef, useState } from 'react'

import { useSynchronizedScroll } from '@/hooks'
import { useViewStore } from '@/stores'
import type { CurveData, TrackConfig } from '@/types'

import { DataTrack } from './DataTrack'
import { DepthTrack } from './DepthTrack'
import { FormationColumn } from './FormationColumn'
import { TrackHeaderRow } from './TrackHeaderRow'
import { DEPTH_TRACK_ID, FORMATION_TRACK_ID, TrackResizeHandle } from './TrackResizeHandle'

interface LogViewPanelProps {
  tracks: TrackConfig[]
  curves: CurveData[]
  minDepth: number
  maxDepth: number
}

const DEFAULT_DEPTH_WIDTH = 60
const DEFAULT_FORMATION_WIDTH = 80

export function LogViewPanel({ tracks, curves, minDepth, maxDepth }: LogViewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [trackHeight, setTrackHeight] = useState(600)
  const setViewportHeight = useViewStore((state) => state.setViewportHeight)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const depthWidth = trackWidths[DEPTH_TRACK_ID] ?? DEFAULT_DEPTH_WIDTH
  const formationWidth = trackWidths[FORMATION_TRACK_ID] ?? DEFAULT_FORMATION_WIDTH

  useSynchronizedScroll(containerRef, minDepth, maxDepth)

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 600
      if (height > 0) {
        setTrackHeight(height)
        setViewportHeight(height)
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [setViewportHeight])

  return (
    <div ref={containerRef} className="log-view-panel">
      <TrackHeaderRow tracks={tracks} />
      <div className="log-view-panel__tracks">
        <DepthTrack height={trackHeight} width={depthWidth} />
        <TrackResizeHandle trackId={DEPTH_TRACK_ID} initialWidth={depthWidth} />
        {tracks.map((track) => {
          const width = trackWidths[track.id] ?? track.width

          return (
            <Fragment key={track.id}>
              <DataTrack
                config={track}
                curves={curves}
                width={width}
                height={trackHeight}
              />
              <TrackResizeHandle
                trackId={track.id}
                initialWidth={width}
              />
            </Fragment>
          )
        })}
        <FormationColumn height={trackHeight} maxDepth={maxDepth} width={formationWidth} />
        <TrackResizeHandle
          trackId={FORMATION_TRACK_ID}
          initialWidth={formationWidth}
        />
      </div>
    </div>
  )
}

