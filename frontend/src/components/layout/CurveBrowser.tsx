import { buildTrackOrder, useViewStore, useWellDataStore, useWorkspaceStore, createEmptyTrack } from '@/stores'
import { buildCurveDefaults } from '@/utils/curvePresets'

export function CurveBrowser() {
  const well = useWellDataStore((s) => s.well)
  const curves = useWellDataStore((s) => s.curves)
  const wellViewStates = useWorkspaceStore((s) => s.wellViewStates)
  const updateWellViewState = useWorkspaceStore((s) => s.updateWellViewState)
  const selectedTrackId = useViewStore((s) => s.selectedTrackId)

  if (!well) return <p className="sidebar-panel__empty">No well loaded.</p>

  const wellId = well.well_id
  const viewState = wellViewStates[wellId]
  const allTrackCurves = new Set(viewState?.tracks.flatMap((t) => t.curves.map((c) => c.mnemonic)) ?? [])

  function handleAdd(mnemonic: string) {
    const curve = curves.find((c) => c.mnemonic === mnemonic)
    if (!curve) return

    updateWellViewState(wellId, (state) => {
      if (state.tracks.some((t) => t.curves.some((c) => c.mnemonic === mnemonic))) return state

      const existingCount = state.tracks.reduce((n, t) => n + t.curves.length, 0)
      const { curveConfig, scaleType } = buildCurveDefaults(curve, existingCount)

      if (selectedTrackId && state.tracks.some((t) => t.id === selectedTrackId)) {
        return {
          ...state,
          tracks: state.tracks.map((t) =>
            t.id !== selectedTrackId ? t : { ...t, curves: [...t.curves, curveConfig] },
          ),
        }
      }

      const nextNum = Math.max(0, ...state.tracks.map((t) => {
        const m = /^track-(\d+)$/.exec(t.id)
        return m ? Number(m[1]) : 0
      })) + 1

      return {
        ...state,
        tracks: [
          ...state.tracks.filter((t) => t.curves.length > 0 || t.id === (state.tracks[0]?.id)),
          {
            ...createEmptyTrack(`track-${nextNum}`, `Track ${nextNum}`),
            scaleType,
            curves: [curveConfig],
          },
        ],
        trackOrder: buildTrackOrder(
          [
            ...state.tracks
              .filter((t) => t.curves.length > 0 || t.id === (state.tracks[0]?.id))
              .map((track) => track.id),
            `track-${nextNum}`,
          ],
          state.trackOrder,
        ),
      }
    })
  }

  const sorted = [...curves].sort((a, b) => a.mnemonic.localeCompare(b.mnemonic))

  return (
    <div className="curve-browser">
      {sorted.length === 0 ? (
        <p className="sidebar-panel__empty">No curves loaded.</p>
      ) : (
        <ul className="curve-browser__rows">
          {sorted.map((curve) => {
            const inTrack = allTrackCurves.has(curve.mnemonic)
            return (
              <li key={curve.mnemonic} className={`curve-browser__row ${inTrack ? 'curve-browser__row--added' : ''}`}>
                <span className="curve-browser__mnemonic">{curve.mnemonic}</span>
                <span className="curve-browser__unit">{curve.unit || '—'}</span>
                <button
                  type="button"
                  className="curve-browser__add-btn"
                  disabled={inTrack}
                  title={inTrack ? 'Already in a track' : 'Add to track'}
                  onClick={() => handleAdd(curve.mnemonic)}
                >
                  ＋
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
