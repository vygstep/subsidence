import { useViewStore, useWellDataStore, useWorkspaceStore, createEmptyTrack } from '@/stores'
import type { TrackConfig } from '@/types'

const TRACK_COLORS = ['#22c55e', '#ef4444', '#2563eb', '#f59e0b', '#8b5cf6', '#0f766e', '#dc2626', '#475569']

function computeBounds(values: Float32Array, nullValue: number) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v) || v === nullValue) continue
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const fallback = Number.isFinite(min) ? min : 0
    return { min: fallback, max: fallback + 1 }
  }
  return { min, max }
}

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
      const bounds = computeBounds(curve.values, curve.null_value)
      const curveConfig: TrackConfig['curves'][number] = {
        mnemonic: curve.mnemonic,
        unit: curve.unit,
        color: TRACK_COLORS[existingCount % TRACK_COLORS.length],
        lineWidth: 1.5,
        lineStyle: 'solid',
        scaleMin: bounds.min,
        scaleMax: bounds.max,
        scaleReversed: false,
      }

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
            curves: [curveConfig],
          },
        ],
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
