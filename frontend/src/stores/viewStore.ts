import { create } from 'zustand'

interface VisibleDepthRange {
  min: number
  max: number
}

interface VisualConfigPayload {
  depthPerPixel?: number
  trackWidths?: Record<string, number>
  splitRatio?: number
}

export type SelectedElementType = 'curve' | 'track' | 'formation'

export interface ViewStore {
  scrollDepth: number
  depthPerPixel: number
  visibleDepthRange: VisibleDepthRange
  cursorDepth: number | null
  overviewVisible: boolean
  curveTooltipVisible: boolean
  interactionMode: 'view' | 'edit-tops'
  selectedTrackId: string | null
  selectedElementId: string | null
  selectedElementType: SelectedElementType | null
  trackWidths: Record<string, number>
  viewportHeight: number
  splitRatio: number
  setScroll: (depth: number) => void
  setScale: (dpp: number) => void
  setCursorDepth: (depth: number | null) => void
  setOverviewVisible: (visible: boolean) => void
  setCurveTooltipVisible: (visible: boolean) => void
  setInteractionMode: (mode: 'view' | 'edit-tops') => void
  selectTrack: (trackId: string | null) => void
  selectElement: (id: string, type: SelectedElementType) => void
  clearSelection: () => void
  setViewportHeight: (height: number) => void
  setTrackWidth: (id: string, width: number) => void
  setSplitRatio: (ratio: number) => void
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
const initialSplitRatio = 0.55
const minimumTrackWidth = 80
const DEPTH_TRACK_ID = 'depth'
const FORMATION_TRACK_ID = 'formations'

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
  selectedTrackId: null,
  selectedElementId: null,
  selectedElementType: null,
  trackWidths: {},
  viewportHeight: initialViewportHeight,
  splitRatio: initialSplitRatio,
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
  setSplitRatio(ratio) {
    set({ splitRatio: Math.max(0.2, Math.min(0.8, ratio)) })
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
      const rawRatio = config.splitRatio ?? state.splitRatio
      return {
        depthPerPixel: nextDepthPerPixel,
        trackWidths: normalizeTrackWidths(config.trackWidths),
        splitRatio: Math.max(0.2, Math.min(0.8, rawRatio)),
        visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, nextDepthPerPixel, state.viewportHeight),
      }
    })
  },
  resetVisualConfig() {
    set((state) => ({
      depthPerPixel: initialDepthPerPixel,
      trackWidths: {},
      visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, initialDepthPerPixel, state.viewportHeight),
    }))
  },
}))
