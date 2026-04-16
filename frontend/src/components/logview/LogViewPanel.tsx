import { useEffect, useRef, useState } from 'react'

import { useSynchronizedScroll } from '@/hooks'
import { useViewStore } from '@/stores'
import type { CurveData, TrackConfig } from '@/types'

import { DataTrack } from './DataTrack'
import { DepthTrack } from './DepthTrack'
import { FormationColumn } from './FormationColumn'
import { TrackHeaderRow } from './TrackHeaderRow'

interface LogViewPanelProps {
  tracks: TrackConfig[]
  curves: CurveData[]
  minDepth: number
  maxDepth: number
}

export function LogViewPanel({ tracks, curves, minDepth, maxDepth }: LogViewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [trackHeight, setTrackHeight] = useState(600)
  const setViewportHeight = useViewStore((state) => state.setViewportHeight)

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
        <DepthTrack height={trackHeight} />
        {tracks.map((track) => (
          <DataTrack
            key={track.id}
            config={track}
            curves={curves}
            width={track.width}
            height={trackHeight}
          />
        ))}
        <FormationColumn height={trackHeight} maxDepth={maxDepth} />
      </div>
    </div>
  )
}
