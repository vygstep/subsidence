import { create } from 'zustand'

import type { TrackConfig } from '@/types'

export type SidebarTab = 'wells' | 'models' | 'strat-charts'
export type ToolbarMode = 'project' | 'strat-chart' | 'wells' | 'tops'
export type SelectedObject =
  | { type: 'well'; wellId: string }
  | { type: 'las-group'; wellId: string }
  | { type: 'curve'; wellId: string; mnemonic: string }
  | { type: 'tops-group'; wellId: string }
  | { type: 'top-pick'; wellId: string; formationId: string }
  | { type: 'strat-chart'; chartId: number }

export interface WellViewState {
  tracks: TrackConfig[]
  visibleFormationIds: string[]
  deviationVisible: boolean
  hiddenTrackIds: string[]
}

const DEFAULT_SIDEBAR_WIDTH = 320
const DEFAULT_SIDEBAR_TOP_RATIO = 0.66

export function createEmptyTrack(trackId = 'track-1', title = 'Track 1'): TrackConfig {
  return {
    id: trackId,
    title,
    width: 200,
    scaleType: 'linear',
    gridDivisions: 3,
    showGrid: true,
    curves: [],
  }
}

export function createDefaultWellView(): WellViewState {
  return {
    tracks: [createEmptyTrack()],
    visibleFormationIds: [],
    deviationVisible: false,
    hiddenTrackIds: [],
  }
}

function isCurveConfig(value: unknown): value is TrackConfig['curves'][number] {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.mnemonic === 'string'
    && typeof row.color === 'string'
    && typeof row.lineWidth === 'number'
    && typeof row.lineStyle === 'string'
    && typeof row.scaleMin === 'number'
    && typeof row.scaleMax === 'number'
    && typeof row.scaleReversed === 'boolean'
}

function isTrackConfig(value: unknown): value is TrackConfig {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string'
    && typeof row.title === 'string'
    && typeof row.width === 'number'
    && Array.isArray(row.curves)
    && row.curves.every(isCurveConfig)
    && (row.scaleType === 'linear' || row.scaleType === 'logarithmic')
    && typeof row.gridDivisions === 'number'
    && typeof row.showGrid === 'boolean'
}

export function coerceWellViewState(raw: unknown): WellViewState {
  const fallback = createDefaultWellView()
  if (!raw || typeof raw !== 'object') {
    return fallback
  }

  const value = raw as Record<string, unknown>
  const tracks = Array.isArray(value.tracks) ? value.tracks.filter(isTrackConfig) : fallback.tracks
  const visibleFormationIds = Array.isArray(value.visibleFormationIds)
    ? value.visibleFormationIds.filter((id): id is string => typeof id === 'string')
    : fallback.visibleFormationIds
  const hiddenTrackIds = Array.isArray(value.hiddenTrackIds)
    ? value.hiddenTrackIds.filter((id): id is string => typeof id === 'string')
    : fallback.hiddenTrackIds
  const deviationVisible = typeof value.deviationVisible === 'boolean'
    ? value.deviationVisible
    : fallback.deviationVisible

  return {
    tracks: tracks.length > 0 ? tracks : fallback.tracks,
    visibleFormationIds,
    deviationVisible,
    hiddenTrackIds,
  }
}

interface WorkspaceStore {
  activeSidebarTab: SidebarTab
  activeToolbarMode: ToolbarMode
  selectedFormationId: string | null
  selectedObject: SelectedObject | null
  sidebarWidth: number
  sidebarTopRatio: number
  wellViewStates: Record<string, WellViewState>
  setActiveSidebarTab: (tab: SidebarTab) => void
  setActiveToolbarMode: (mode: ToolbarMode) => void
  setSelectedFormationId: (formationId: string | null) => void
  setSelectedObject: (selectedObject: SelectedObject | null) => void
  setSidebarWidth: (width: number) => void
  setSidebarTopRatio: (ratio: number) => void
  resetWorkspace: () => void
  updateWellViewState: (wellId: string, updater: (state: WellViewState) => WellViewState) => void
  replaceWellViewStates: (nextStates: Record<string, WellViewState>) => void
  ensureWellViewState: (wellId: string) => void
  dropWellViewState: (wellId: string) => void
}

const initialState = {
  activeSidebarTab: 'wells' as SidebarTab,
  activeToolbarMode: 'project' as ToolbarMode,
  selectedFormationId: null as string | null,
  selectedObject: null as SelectedObject | null,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  sidebarTopRatio: DEFAULT_SIDEBAR_TOP_RATIO,
  wellViewStates: {} as Record<string, WellViewState>,
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  ...initialState,
  setActiveSidebarTab(activeSidebarTab) {
    set({ activeSidebarTab })
  },
  setActiveToolbarMode(activeToolbarMode) {
    set({ activeToolbarMode })
  },
  setSelectedFormationId(selectedFormationId) {
    set({ selectedFormationId })
  },
  setSelectedObject(selectedObject) {
    set({ selectedObject })
  },
  setSidebarWidth(sidebarWidth) {
    set({ sidebarWidth })
  },
  setSidebarTopRatio(sidebarTopRatio) {
    set({ sidebarTopRatio })
  },
  resetWorkspace() {
    set(initialState)
  },
  updateWellViewState(wellId, updater) {
    set((state) => ({
      wellViewStates: {
        ...state.wellViewStates,
        [wellId]: updater(state.wellViewStates[wellId] ?? createDefaultWellView()),
      },
    }))
  },
  replaceWellViewStates(nextStates) {
    set({ wellViewStates: nextStates })
  },
  ensureWellViewState(wellId) {
    set((state) => (
      state.wellViewStates[wellId]
        ? state
        : {
            wellViewStates: {
              ...state.wellViewStates,
              [wellId]: createDefaultWellView(),
            },
          }
    ))
  },
  dropWellViewState(wellId) {
    set((state) => {
      const next = { ...state.wellViewStates }
      delete next[wellId]
      return { wellViewStates: next }
    })
  },
}))
