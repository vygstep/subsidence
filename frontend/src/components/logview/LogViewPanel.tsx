import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSynchronizedScroll } from '@/hooks'
import { useViewStore } from '@/stores'
import type { CurveData, FormationTop, TrackConfig } from '@/types'

import { InteractionOverlay } from '../interaction'
import { DataTrack } from './DataTrack'
import { DepthTrack } from './DepthTrack'
import { FormationColumn } from './FormationColumn'
import { TrackHeaderRow } from './TrackHeaderRow'
import { DEPTH_TRACK_ID, FORMATION_TRACK_ID, TrackResizeHandle } from './TrackResizeHandle'
import { WellOverviewMinimap } from './WellOverviewMinimap'
import { WellViewerToolbar } from './WellViewerToolbar'

interface LogViewPanelProps {
  tracks: TrackConfig[]
  trackOrder: string[]
  curves: CurveData[]
  formations: FormationTop[]
  minDepth: number
  maxDepth: number
}

const DEFAULT_DEPTH_WIDTH = 60
const DEFAULT_FORMATION_WIDTH = 80

export function LogViewPanel({ tracks, trackOrder, curves, formations, minDepth, maxDepth }: LogViewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [trackHeight, setTrackHeight] = useState(600)

  const setViewportHeight = useViewStore((state) => state.setViewportHeight)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const scrollDepth = useViewStore((state) => state.scrollDepth)
  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const cursorDepth = useViewStore((state) => state.cursorDepth)
  const setCursorDepth = useViewStore((state) => state.setCursorDepth)
  const selectedTrackId = useViewStore((state) => state.selectedTrackId)
  const overviewVisible = useViewStore((state) => state.overviewVisible)
  const curveTooltipVisible = useViewStore((state) => state.curveTooltipVisible)
  const interactionMode = useViewStore((state) => state.interactionMode)

  const depthWidth = trackWidths[DEPTH_TRACK_ID] ?? DEFAULT_DEPTH_WIDTH
  const formationWidth = trackWidths[FORMATION_TRACK_ID] ?? DEFAULT_FORMATION_WIDTH
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  const depthToPixel = useCallback(
    (depth: number) => (depth - scrollDepth) / depthPerPixel,
    [scrollDepth, depthPerPixel],
  )

  const [mouseClient, setMouseClient] = useState<{ x: number; y: number } | null>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      setCursorDepth(scrollDepth + y * depthPerPixel)
      setMouseClient({ x: e.clientX, y: e.clientY })
    },
    [scrollDepth, depthPerPixel, setCursorDepth],
  )

  const handleMouseLeave = useCallback(() => {
    setCursorDepth(null)
    setMouseClient(null)
  }, [setCursorDepth])

  useSynchronizedScroll(containerRef, minDepth, maxDepth)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

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
      <div className="log-view-panel__workspace">
        <WellViewerToolbar />
        <div className="log-view-panel__content">
          <TrackHeaderRow tracks={tracks} trackOrder={trackOrder} />
          <div className="log-view-panel__tracks" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            {trackOrder.map((trackId) => {
              if (trackId === DEPTH_TRACK_ID) {
                return (
                  <Fragment key={trackId}>
                    <DepthTrack
                      height={trackHeight}
                      width={depthWidth}
                      isSelected={selectedTrackId === DEPTH_TRACK_ID}
                    />
                    <TrackResizeHandle trackId={DEPTH_TRACK_ID} initialWidth={depthWidth} />
                  </Fragment>
                )
              }

              if (trackId === FORMATION_TRACK_ID) {
                return (
                  <Fragment key={trackId}>
                    <FormationColumn
                      formations={formations}
                      height={trackHeight}
                      maxDepth={maxDepth}
                      width={formationWidth}
                      isSelected={selectedTrackId === FORMATION_TRACK_ID}
                    />
                    <TrackResizeHandle trackId={FORMATION_TRACK_ID} initialWidth={formationWidth} />
                  </Fragment>
                )
              }

              const track = tracksById.get(trackId)
              if (!track) {
                return null
              }
              const width = trackWidths[track.id] ?? track.width
              return (
                <Fragment key={track.id}>
                  <DataTrack config={track} curves={curves} width={width} height={trackHeight} />
                  <TrackResizeHandle trackId={track.id} initialWidth={width} />
                </Fragment>
              )
            })}
            <InteractionOverlay
              height={trackHeight}
              formations={formations}
              curves={curves}
              depthToPixel={depthToPixel}
              cursorDepth={cursorDepth}
              mouseClient={mouseClient}
              tooltipVisible={curveTooltipVisible}
              topsEditable={interactionMode === 'edit-tops'}
            />
            {overviewVisible ? <WellOverviewMinimap height={trackHeight} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
