import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSynchronizedScroll } from '@/hooks'
import { useViewStore, useWellDataStore } from '@/stores'
import { DEPTH_TRACK_ID, FORMATION_TRACK_ID, useWorkspaceStore } from '@/stores/workspaceStore'
import type { CurveData, FormationTop, FormationZone, TrackConfig } from '@/types'

import { InteractionOverlay } from '../interaction'
import { DataTrack } from './DataTrack'
import { DepthTrack } from './DepthTrack'
import { FormationColumn } from './FormationColumn'
import { TrackHeaderRow } from './TrackHeaderRow'
import { TrackResizeHandle, TRACK_RESIZE_HANDLE_WIDTH } from './TrackResizeHandle'
import { WellOverviewMinimap } from './WellOverviewMinimap'
import { WellViewerToolbar } from './WellViewerToolbar'

interface LogViewPanelProps {
  tracks: TrackConfig[]
  trackOrder: string[]
  curves: CurveData[]
  formations: FormationTop[]
  zoneFormations: FormationTop[]
  zones: FormationZone[]
  minDepth: number
  maxDepth: number
}

const DEFAULT_DEPTH_WIDTH = 60
const DEFAULT_FORMATION_WIDTH = 80

export function LogViewPanel({ tracks, trackOrder, curves, formations, zoneFormations, zones, minDepth, maxDepth }: LogViewPanelProps) {
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
  const activePickId = useViewStore((state) => state.activePickId)
  const setActivePickId = useViewStore((state) => state.setActivePickId)
  const lodEnabled = useViewStore((state) => state.lodEnabled)
  const depthType = useViewStore((state) => state.depthType)
  const updateFormationDepth = useWellDataStore((state) => state.updateFormationDepth)
  const well = useWellDataStore((state) => state.well)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const loadWellInventories = useWellDataStore((state) => state.loadWellInventories)
  const refreshWell = useWellDataStore((state) => state.refreshWell)
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)

  const depthWidth = trackWidths[DEPTH_TRACK_ID] ?? DEFAULT_DEPTH_WIDTH
  const formationWidth = trackWidths[FORMATION_TRACK_ID] ?? DEFAULT_FORMATION_WIDTH
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])
  const tracksPixelWidth = useMemo(() => trackOrder.reduce((total, trackId) => {
    if (trackId === DEPTH_TRACK_ID) {
      return total + depthWidth + TRACK_RESIZE_HANDLE_WIDTH
    }
    if (trackId === FORMATION_TRACK_ID) {
      return total + formationWidth + TRACK_RESIZE_HANDLE_WIDTH
    }
    const track = tracksById.get(trackId)
    if (!track) {
      return total
    }
    return total + (trackWidths[track.id] ?? track.width) + TRACK_RESIZE_HANDLE_WIDTH
  }, 0), [depthWidth, formationWidth, trackOrder, tracksById, trackWidths])

  const depthToPixel = useCallback(
    (depth: number) => (depth - scrollDepth) / depthPerPixel,
    [scrollDepth, depthPerPixel],
  )

  const [mouseClient, setMouseClient] = useState<{ x: number; y: number } | null>(null)
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const x = e.clientX - rect.left
      setCursorDepth(scrollDepth + y * depthPerPixel)
      setMouseClient({ x: e.clientX, y: e.clientY })

      // Determine which data track is under the cursor
      let offsetX = 0
      let nextHovered: string | null = null
      for (const trackId of trackOrder) {
        let w: number
        if (trackId === DEPTH_TRACK_ID) {
          w = depthWidth
        } else if (trackId === FORMATION_TRACK_ID) {
          w = formationWidth
        } else {
          const track = tracksById.get(trackId)
          w = track ? (trackWidths[track.id] ?? track.width) : 0
          if (x >= offsetX && x < offsetX + w) {
            nextHovered = trackId
            break
          }
        }
        offsetX += w + TRACK_RESIZE_HANDLE_WIDTH
      }
      setHoveredTrackId(nextHovered)
    },
    [scrollDepth, depthPerPixel, setCursorDepth, trackOrder, depthWidth, formationWidth, tracksById, trackWidths],
  )

  const handleMouseLeave = useCallback(() => {
    setCursorDepth(null)
    setMouseClient(null)
    setHoveredTrackId(null)
  }, [setCursorDepth])

  const handleTracksClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactionMode !== 'edit-tops') return
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const depth = scrollDepth + y * depthPerPixel
      const selectedPick = selectedFormationId === null
        ? null
        : zoneFormations.find((formation) => formation.id === selectedFormationId) ?? null
      const targetPickId = activePickId ?? selectedPick?.id ?? null
      const formationByHorizonId = new Map(zoneFormations.filter((f) => f.horizon_id !== null).map((f) => [f.horizon_id!, f]))
      const validateDepth = (formation: FormationTop, candidateDepth: number): boolean => {
        if (formation.horizon_id === null) return true
        const upperZone = zones.find((zone) => zone.lower_horizon.id === formation.horizon_id)
        const lowerZone = zones.find((zone) => zone.upper_horizon.id === formation.horizon_id)
        const upperFormation = upperZone ? formationByHorizonId.get(upperZone.upper_horizon.id) : null
        const lowerFormation = lowerZone ? formationByHorizonId.get(lowerZone.lower_horizon.id) : null
        if (upperFormation?.depth_md !== null && upperFormation?.depth_md !== undefined && candidateDepth <= upperFormation.depth_md) {
          return false
        }
        if (lowerFormation?.depth_md !== null && lowerFormation?.depth_md !== undefined && candidateDepth >= lowerFormation.depth_md) {
          return false
        }
        return true
      }

      if (targetPickId !== null) {
        const target = zoneFormations.find((formation) => formation.id === targetPickId)
        if (!target) return
        if (!validateDepth(target, depth)) {
          window.alert('Cannot place top outside its stratigraphic interval.')
          return
        }
        setActivePickId(targetPickId)
        await updateFormationDepth(targetPickId, depth)
        return
      }

      if (!well) return
      const inventory = wellInventories.find((item) => item.well_id === well.well_id)
      if (!inventory?.active_top_set_id) {
        window.alert('Choose an active TopSet first.')
        return
      }
      const clickedZone = zones.find((zone) => {
        const upper = formationByHorizonId.get(zone.upper_horizon.id)
        const lower = formationByHorizonId.get(zone.lower_horizon.id)
        if (upper?.depth_md === null || upper?.depth_md === undefined || lower?.depth_md === null || lower?.depth_md === undefined) {
          return false
        }
        return depth > upper.depth_md && depth < lower.depth_md
      })
      if (!clickedZone) {
        window.alert('Click inside an existing zone to add a top. To extend below/above the current markers, select an existing marker or add the marker manually in the TopSet.')
        return
      }
      const response = await fetch(`/api/top-sets/${inventory.active_top_set_id}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ well_id: well.well_id, split_zone_id: clickedZone.zone_id, depth_md: depth }),
      })
      if (!response.ok) {
        let message = `Failed to add top (${response.status})`
        const text = await response.text()
        try {
          const payload = JSON.parse(text) as { detail?: string }
          if (payload.detail) message = payload.detail
        } catch {
          if (text) message = text
        }
        window.alert(message)
        return
      }
      const created = await response.json() as { formation_id: string }
      updateWellViewState(well.well_id, (state) => ({
        ...state,
        visibleFormationIds: Array.from(new Set([...state.visibleFormationIds, created.formation_id])),
      }))
      await loadWellInventories()
      await refreshWell(well.well_id)
      setSelectedFormationId(created.formation_id)
      setSelectedObject({ type: 'top-pick', wellId: well.well_id, formationId: created.formation_id })
      setActivePickId(created.formation_id)
    },
    [
      interactionMode,
      activePickId,
      selectedFormationId,
      scrollDepth,
      depthPerPixel,
      zoneFormations,
      zones,
      well,
      wellInventories,
      updateFormationDepth,
      setActivePickId,
      updateWellViewState,
      loadWellInventories,
      refreshWell,
      setSelectedFormationId,
      setSelectedObject,
    ],
  )

  const tooltipCurves = useMemo(() => {
    if (!hoveredTrackId) return []
    const track = tracksById.get(hoveredTrackId)
    if (!track) return []
    const mnemonics = new Set(track.curves.map((c) => c.mnemonic))
    return curves.filter((c) => mnemonics.has(c.mnemonic))
  }, [hoveredTrackId, tracksById, curves])

  const minimapCurves = useMemo(() => {
    const configuredMnemonics = new Set(
      tracks.flatMap((track) => track.curves.map((c) => c.mnemonic)),
    )
    return curves.filter((c) => configuredMnemonics.has(c.mnemonic))
  }, [tracks, curves])

  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const fetchCurvesLOD = useWellDataStore((state) => state.fetchCurvesLOD)

  useSynchronizedScroll(containerRef, minDepth, maxDepth)

  // LOD: when zoomed out past 1 m/px, fetch downsampled curves for the visible window
  // Disabled in TVD/TVDSS mode — full converted curves are used instead
  useEffect(() => {
    if (!lodEnabled || depthPerPixel <= 1.0 || depthType !== 'MD') return
    const resolution = Math.ceil(trackHeight / 2)
    const timer = window.setTimeout(() => {
      void fetchCurvesLOD(visibleDepthRange.min, visibleDepthRange.max, resolution)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [lodEnabled, depthType, depthPerPixel, visibleDepthRange.min, visibleDepthRange.max, trackHeight, fetchCurvesLOD])

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
    <div className="log-view-panel">
      <div className="log-view-panel__workspace">
        <WellViewerToolbar />
        <div className="log-view-panel__content">
          <TrackHeaderRow tracks={tracks} trackOrder={trackOrder} />
          <div className="log-view-panel__body">
          <div ref={containerRef} className="log-view-panel__tracks" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleTracksClick}>
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
                      formations={zoneFormations}
                      visibleMarkerFormations={formations}
                      zones={zones}
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
              width={tracksPixelWidth}
              height={trackHeight}
              formations={formations}
              curves={tooltipCurves}
              depthToPixel={depthToPixel}
              cursorDepth={cursorDepth}
              mouseClient={mouseClient}
              tooltipVisible={curveTooltipVisible}
              topsEditable={interactionMode === 'edit-tops'}
            />
          </div>
          {overviewVisible ? <WellOverviewMinimap height={trackHeight} curves={minimapCurves} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
