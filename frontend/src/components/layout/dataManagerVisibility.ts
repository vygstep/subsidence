import { buildTrackOrder, createEmptyTrack, useWellDataStore } from '@/stores'
import type { Well, TrackConfig } from '@/types'
import type { WellViewState } from '@/stores/workspaceStore'
import { buildCurveDefaults } from '@/utils/curvePresets'

interface VisibilityDeps {
  well: Well | null
  selectedTrackId: string | null
  updateWellViewState: (wellId: string, updater: (state: WellViewState) => WellViewState) => void
  loadWell: (wellId: string) => Promise<void>
}

function nextTrackNumber(tracks: TrackConfig[]): number {
  const numbers = tracks.map((track) => {
    const match = /^track-(\d+)$/.exec(track.id)
    return match ? Number(match[1]) : 0
  })
  return Math.max(0, ...numbers) + 1
}

export function makeVisibilityHandlers(deps: VisibilityDeps) {
  const { well, selectedTrackId, updateWellViewState, loadWell } = deps

  async function handleSetDeviationVisible(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    updateWellViewState(wellId, (state) => ({ ...state, deviationVisible: nextValue }))
  }

  async function handleToggleFormation(wellId: string, formationId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: nextValue
        ? Array.from(new Set([...state.visibleFormationIds, formationId]))
        : state.visibleFormationIds.filter((id) => id !== formationId),
    }))
  }

  async function handleToggleAllFormations(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    const currentFormations = useWellDataStore.getState().formations
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: nextValue ? currentFormations.map((f) => f.id) : [],
    }))
  }

  async function handleToggleCurve(wellId: string, mnemonic: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    const activeWellId = useWellDataStore.getState().well?.well_id
    if (!activeWellId) return
    const curve = useWellDataStore.getState().curves.find((c) => c.mnemonic === mnemonic)
    if (!curve) return

    updateWellViewState(activeWellId, (state) => {
      if (!nextValue) {
        const nextTracks = state.tracks.map((track) => ({
          ...track,
          curves: track.curves.filter((c) => c.mnemonic !== mnemonic),
        }))
        const hasAnyCurve = nextTracks.some((track) => track.curves.length > 0)
        const finalTracks = hasAnyCurve ? nextTracks : [createEmptyTrack()]
        return {
          ...state,
          tracks: finalTracks,
          trackOrder: buildTrackOrder(finalTracks.map((track) => track.id), state.trackOrder),
        }
      }

      if (state.tracks.some((track) => track.curves.some((c) => c.mnemonic === mnemonic))) {
        return state
      }

      const existingCount = state.tracks.reduce((n, t) => n + t.curves.length, 0)
      const { curveConfig, scaleType } = buildCurveDefaults(curve, existingCount)

      if (selectedTrackId && state.tracks.some((t) => t.id === selectedTrackId)) {
        return {
          ...state,
          tracks: state.tracks.map((track) =>
            track.id !== selectedTrackId ? track : { ...track, curves: [...track.curves, curveConfig] },
          ),
        }
      }

      const trackNumber = nextTrackNumber(state.tracks)
      return {
        ...state,
        tracks: [
          ...state.tracks,
          {
            id: `track-${trackNumber}`,
            title: `Track ${trackNumber}`,
            width: 200,
            scaleType,
            gridDivisions: 3,
            showGrid: true,
            curves: [curveConfig],
          },
        ],
        trackOrder: buildTrackOrder(
          [...state.tracks.map((track) => track.id), `track-${trackNumber}`],
          state.trackOrder,
        ),
      }
    })
  }

  async function handleToggleAllCurves(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    if (!nextValue) {
      updateWellViewState(wellId, (state) => {
        const track = createEmptyTrack()
        return {
          ...state,
          tracks: [track],
          trackOrder: buildTrackOrder([track.id], state.trackOrder),
        }
      })
      return
    }
    useWellDataStore.getState().curves.forEach((curve) => {
      void handleToggleCurve(wellId, curve.mnemonic, true)
    })
  }

  function handleCurveSettingUpdate(mnemonic: string, patch: Partial<TrackConfig['curves'][number]>): void {
    if (!well?.well_id) return
    updateWellViewState(well.well_id, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => ({
        ...track,
        curves: track.curves.map((curve) => (curve.mnemonic === mnemonic ? { ...curve, ...patch } : curve)),
      })),
    }))
  }

  function handleTrackSettingUpdate(trackId: string, patch: Partial<TrackConfig>): void {
    if (!well?.well_id) return
    updateWellViewState(well.well_id, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
    }))
  }

  return {
    handleSetDeviationVisible,
    handleToggleFormation,
    handleToggleAllFormations,
    handleToggleCurve,
    handleToggleAllCurves,
    handleCurveSettingUpdate,
    handleTrackSettingUpdate,
  }
}
