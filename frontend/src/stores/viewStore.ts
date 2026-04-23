import { create } from 'zustand'

import { DEPTH_TRACK_ID, FORMATION_TRACK_ID } from './workspaceStore'

interface VisibleDepthRange {
  min: number
  max: number
}

interface VisualConfigPayload {
  depthPerPixel?: number
  trackWidths?: Record<string, number>
  subsidenceWidth?: number
  depthTrackConfig?: Partial<DepthTrackConfig>
  formationsTrackConfig?: Partial<FormationsTrackConfig>
}

export type SelectedElementType = 'curve' | 'track' | 'formation'

export interface DepthTrackConfig {
  backgroundColor: string
  majorInterval: number
  minorInterval: number
  unit: 'm' | 'km' | 'ft'
}

export interface FormationsTrackConfig {
  backgroundColor: string
  nameSource: 'formation-name' | 'linked-strat-unit'
}

export interface ViewStore {
  scrollDepth: number
  depthPerPixel: number
  visibleDepthRange: VisibleDepthRange
  cursorDepth: number | null
  overviewVisible: boolean
  curveTooltipVisible: boolean
  interactionMode: 'view' | 'edit-tops'
  depthTrackConfig: DepthTrackConfig
  formationsTrackConfig: FormationsTrackConfig
  selectedTrackId: string | null
  selectedElementId: string | null
  selectedElementType: SelectedElementType | null
  trackWidths: Record<string, number>
  viewportHeight: number
  subsidenceWidth: number
  subsidenceBottomHeight: number
  depthType: 'MD' | 'TVD'
  setScroll: (depth: number) => void
  setScale: (dpp: number) => void

  setCursorDepth: (depth: number | null) => void
  setOverviewVisible: (visible: boolean) => void
  setCurveTooltipVisible: (visible: boolean) => void
  setInteractionMode: (mode: 'view' | 'edit-tops') => void
  updateDepthTrackConfig: (patch: Partial<DepthTrackConfig>) => void
  updateFormationsTrackConfig: (patch: Partial<FormationsTrackConfig>) => void
  selectTrack: (trackId: string | null) => void
  selectElement: (id: string, type: SelectedElementType) => void
  clearSelection: () => void
  setViewportHeight: (height: number) => void
  setTrackWidth: (id: string, width: number) => void
  setSubsidenceWidth: (width: number) => void
  setSubsidenceBottomHeight: (height: number) => void
  setDepthType: (t: 'MD' | 'TVD') => void
  lodEnabled: boolean
  setLodEnabled: (v: boolean) => void
  applyActiveWellTrackWidths: (trackWidths: Record<string, number>) => void
  applyVisualConfig: (config: VisualConfigPayload) => void
  resetVisualConfig: () => void
}

function deriveVisibleDepthRange(scrollDepth: number, depthPerPixel: number, viewportHeight: number): VisibleDepthRange {
  const span = depthPerPixel * viewportHeight
  return {
    min: scrollDepth,
    max: scrollDepth + span,
  }
}

const initialScrollDepth = 0
const initialDepthPerPixel = 0.2
const initialViewportHeight = 800
const initialSubsidenceWidth = 420
const MIN_SUBSIDENCE_WIDTH = 150
const MAX_SUBSIDENCE_WIDTH = 900
const initialSubsidenceBottomHeight = 200
const MIN_SUBSIDENCE_BOTTOM = 80
const MAX_SUBSIDENCE_BOTTOM = 500
const minimumTrackWidth = 80
const initialDepthTrackConfig: DepthTrackConfig = {
  backgroundColor: '#ffffff',
  majorInterval: 100,
  minorInterval: 10,
  unit: 'm',
}
const initialFormationsTrackConfig: FormationsTrackConfig = {
  backgroundColor: '#ffffff',
  nameSource: 'formation-name',
}

function normalizeTrackWidths(trackWidths: Record<string, number> | undefined): Record<string, number> {
  if (!trackWidths) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(trackWidths).map(([id, width]) => [id, Math.max(minimumTrackWidth, Math.round(width))]),
  )
}

export const useViewStore = create<ViewStore>((set) => ({
  scrollDepth: initialScrollDepth,
  depthPerPixel: initialDepthPerPixel,
  visibleDepthRange: deriveVisibleDepthRange(initialScrollDepth, initialDepthPerPixel, initialViewportHeight),
  cursorDepth: null,
  overviewVisible: true,
  curveTooltipVisible: true,
  interactionMode: 'view',
  depthTrackConfig: initialDepthTrackConfig,
  formationsTrackConfig: initialFormationsTrackConfig,
  selectedTrackId: null,
  selectedElementId: null,
  selectedElementType: null,
  trackWidths: {},
  viewportHeight: initialViewportHeight,
  subsidenceWidth: initialSubsidenceWidth,
  subsidenceBottomHeight: initialSubsidenceBottomHeight,
  depthType: 'MD',
  lodEnabled: true,
  setScroll(depth) {
    set((state) => ({
      scrollDepth: depth,
      visibleDepthRange: deriveVisibleDepthRange(depth, state.depthPerPixel, state.viewportHeight),
    }))
  },
  setScale(depthPerPixel) {
    set((state) => ({
      depthPerPixel,
      visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, depthPerPixel, state.viewportHeight),
    }))
  },
  setCursorDepth(cursorDepth) {
    set({ cursorDepth })
  },
  setOverviewVisible(overviewVisible) {
    set({ overviewVisible })
  },
  setCurveTooltipVisible(curveTooltipVisible) {
    set({ curveTooltipVisible })
  },
  setInteractionMode(interactionMode) {
    set({ interactionMode })
  },
  updateDepthTrackConfig(patch) {
    set((state) => ({
      depthTrackConfig: {
        ...state.depthTrackConfig,
        ...patch,
      },
    }))
  },
  updateFormationsTrackConfig(patch) {
    set((state) => ({
      formationsTrackConfig: {
        ...state.formationsTrackConfig,
        ...patch,
      },
    }))
  },
  selectTrack(selectedTrackId) {
    set({ selectedTrackId, selectedElementId: selectedTrackId, selectedElementType: selectedTrackId ? 'track' : null })
  },
  selectElement(id, type) {
    set({
      selectedElementId: id,
      selectedElementType: type,
      selectedTrackId: type === 'track' ? id : null,
    })
  },
  clearSelection() {
    set({ selectedElementId: null, selectedElementType: null, selectedTrackId: null })
  },
  setViewportHeight(viewportHeight) {
    set((state) => ({
      viewportHeight,
      visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, state.depthPerPixel, viewportHeight),
    }))
  },
  setTrackWidth(id, width) {
    set((state) => ({
      trackWidths: {
        ...state.trackWidths,
        [id]: Math.max(minimumTrackWidth, Math.round(width)),
      },
    }))
  },
  setSubsidenceWidth(width) {
    set({ subsidenceWidth: Math.max(MIN_SUBSIDENCE_WIDTH, Math.min(MAX_SUBSIDENCE_WIDTH, width)) })
  },
  setSubsidenceBottomHeight(height) {
    set({ subsidenceBottomHeight: Math.max(MIN_SUBSIDENCE_BOTTOM, Math.min(MAX_SUBSIDENCE_BOTTOM, height)) })
  },
  setDepthType(t) {
    set({ depthType: t })
  },
  setLodEnabled(v) {
    set({ lodEnabled: v })
  },
  applyActiveWellTrackWidths(trackWidths) {
    set((state) => {
      const preserved: Record<string, number> = {}
      if (state.trackWidths[DEPTH_TRACK_ID] !== undefined) {
        preserved[DEPTH_TRACK_ID] = state.trackWidths[DEPTH_TRACK_ID]
      }
      if (state.trackWidths[FORMATION_TRACK_ID] !== undefined) {
        preserved[FORMATION_TRACK_ID] = state.trackWidths[FORMATION_TRACK_ID]
      }
      return {
        trackWidths: {
          ...preserved,
          ...normalizeTrackWidths(trackWidths),
        },
      }
    })
  },
  applyVisualConfig(config) {
    set((state) => {
      const nextDepthPerPixel = config.depthPerPixel ?? state.depthPerPixel
      const rawWidth = config.subsidenceWidth ?? state.subsidenceWidth
      return {
        depthPerPixel: nextDepthPerPixel,
        trackWidths: normalizeTrackWidths(config.trackWidths),
        subsidenceWidth: Math.max(MIN_SUBSIDENCE_WIDTH, Math.min(MAX_SUBSIDENCE_WIDTH, rawWidth)),
        depthTrackConfig: {
          ...initialDepthTrackConfig,
          ...state.depthTrackConfig,
          ...(config.depthTrackConfig ?? {}),
        },
        formationsTrackConfig: {
          ...initialFormationsTrackConfig,
          ...state.formationsTrackConfig,
          ...(config.formationsTrackConfig ?? {}),
        },
        visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, nextDepthPerPixel, state.viewportHeight),
      }
    })
  },
  resetVisualConfig() {
    set((state) => ({
      depthPerPixel: initialDepthPerPixel,
      trackWidths: {},
      depthTrackConfig: initialDepthTrackConfig,
      formationsTrackConfig: initialFormationsTrackConfig,
      depthType: 'MD',
      visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, initialDepthPerPixel, state.viewportHeight),
    }))
  },
}))
