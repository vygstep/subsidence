import { useMemo } from 'react'

import { LogViewPanel } from '../logview'
import { SubsidencePanel } from '../subsidence'
import { SplitView } from './SplitView'
import { buildTrackOrder, createDefaultWellView, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'

export function ViewerWorkspace() {
  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const formations = useWellDataStore((state) => state.formations)
  const colorOverrides = useWellDataStore((state) => state.colorOverrides)
  const error = useWellDataStore((state) => state.error)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const splitRatio = useViewStore((state) => state.splitRatio)
  const setSplitRatio = useViewStore((state) => state.setSplitRatio)

  const activeWellView = useMemo(() => {
    if (!well?.well_id) return createDefaultWellView()
    return wellViewStates[well.well_id] ?? createDefaultWellView()
  }, [well?.well_id, wellViewStates])

  const { minDepth, maxDepth } = useMemo(() => {
    if (curves.length === 0) return { minDepth: 0, maxDepth: 1000 }
    let min = Infinity
    let max = -Infinity
    for (const curve of curves) {
      if (curve.depths.length > 0) {
        min = Math.min(min, curve.depths[0])
        max = Math.max(max, curve.depths[curve.depths.length - 1])
      }
    }
    return { minDepth: min, maxDepth: max }
  }, [curves])

  const tracks = useMemo(() => (
    activeWellView.tracks
      .filter((track) => !activeWellView.hiddenTrackIds.includes(track.id))
      .map((track) => ({
        ...track,
        curves: track.curves.map((curve) => ({
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
            ratio={splitRatio}
            onRatioChange={setSplitRatio}
            left={
              <LogViewPanel
                tracks={tracks}
                trackOrder={trackOrder}
                curves={curves}
                formations={visibleFormations}
                minDepth={minDepth}
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
