import { useEffect, useMemo, useRef } from 'react'

import { LogViewPanel } from '../logview'
import { SubsidencePanel } from '../subsidence'
import { SplitView } from './SplitView'
import { buildTrackOrder, createDefaultWellView, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import { convertScrollDepth } from '@/utils/depthTransform'

export function ViewerWorkspace() {
  const well = useWellDataStore((state) => state.well)
  const lodCurves = useWellDataStore((state) => state.curves)
  const fullCurves = useWellDataStore((state) => state.fullCurves)
  const formations = useWellDataStore((state) => state.formations)
  const colorOverrides = useWellDataStore((state) => state.colorOverrides)
  const error = useWellDataStore((state) => state.error)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const lodEnabled = useViewStore((state) => state.lodEnabled)
  const depthType = useViewStore((state) => state.depthType)
  const subsidenceWidth = useViewStore((state) => state.subsidenceWidth)
  const setSubsidenceWidth = useViewStore((state) => state.setSubsidenceWidth)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const depthBasis = useWellDataStore((state) => state.depthBasis)
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)
  const reloadCurvesForDepthBasis = useWellDataStore((state) => state.reloadCurvesForDepthBasis)
  const prevKbElevRef = useRef(kbElev)
  // Stores the scroll value to apply once the curve reload for a basis transition completes.
  const pendingScrollRef = useRef<{ scroll: number; targetBasis: 'MD' | 'TVD' | 'TVDSS' } | null>(null)

  useEffect(() => {
    if (!tvdTable) return
    const kbElevChanged = kbElev !== prevKbElevRef.current
    prevKbElevRef.current = kbElev

    if (depthBasis === depthType) {
      if (kbElevChanged && depthType === 'TVDSS') {
        void reloadCurvesForDepthBasis('TVDSS')
      }
      return
    }
    // Basis transition: compute target scroll and start reload.
    // Scroll is NOT applied yet — applied after reload so curves and formations
    // switch coordinate systems atomically.
    const currentScroll = useViewStore.getState().scrollDepth
    const newScroll = convertScrollDepth(currentScroll, depthBasis, depthType, tvdTable, kbElev)
    pendingScrollRef.current = { scroll: newScroll, targetBasis: depthType }
    void reloadCurvesForDepthBasis(depthType)
  }, [depthType, tvdTable, depthBasis, kbElev, reloadCurvesForDepthBasis])

  // Once depthBasis reaches the target, apply the deferred scroll conversion.
  useEffect(() => {
    const pending = pendingScrollRef.current
    if (!pending || pending.targetBasis !== depthBasis) return
    pendingScrollRef.current = null
    useViewStore.getState().setScroll(pending.scroll)
  }, [depthBasis])

  const curves = lodEnabled ? lodCurves : fullCurves
  const wellId = well?.well_id ?? null

  const activeWellView = useMemo(() => {
    if (!wellId) return createDefaultWellView()
    return wellViewStates[wellId] ?? createDefaultWellView()
  }, [wellId, wellViewStates])

  const maxDepth = useMemo(() => {
    if (curves.length === 0) return 1000
    let max = -Infinity
    for (const curve of curves) {
      if (curve.depths.length > 0) max = Math.max(max, curve.depths[curve.depths.length - 1])
    }
    return Number.isFinite(max) ? max : 1000
  }, [curves])

  const tracks = useMemo(() => (
    activeWellView.tracks
      .filter((track) => !activeWellView.hiddenTrackIds.includes(track.id))
      .map((track) => ({
        ...track,
        curves: track.curves
          .filter((curve) => !activeWellView.hiddenCurveMnemonics.includes(curve.mnemonic))
          .map((curve) => ({
            ...curve,
            color: colorOverrides[curve.mnemonic] ?? curve.color,
          })),
      }))
  ), [activeWellView, colorOverrides])

  const visibleFormations = useMemo(() => (
    formations.filter((f) => activeWellView.visibleFormationIds.includes(f.id))
  ), [formations, activeWellView.visibleFormationIds])

  const trackOrder = useMemo(
    () => buildTrackOrder(tracks.map((track) => track.id), activeWellView.trackOrder),
    [tracks, activeWellView.trackOrder],
  )

  return (
    <section className="app-main-pane">
      {error ? (
        <p className="app-error-banner">{error}</p>
      ) : !well ? (
        <p className="app-error-banner">No wells are available in the open project.</p>
      ) : (
        <>
          {curves.length === 0 && (
            <p className="app-error-banner">Well loaded. No curves imported yet.</p>
          )}
          <SplitView
            subsidenceWidth={subsidenceWidth}
            onWidthChange={setSubsidenceWidth}
            left={
              <LogViewPanel
                tracks={tracks}
                trackOrder={trackOrder}
                curves={curves}
                formations={visibleFormations}
                minDepth={0}
                maxDepth={maxDepth}
              />
            }
            right={<SubsidencePanel />}
          />
        </>
      )}
    </section>
  )
}
