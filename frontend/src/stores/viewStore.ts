import { create } from 'zustand'

interface VisibleDepthRange {
  min: number
  max: number
}

interface VisualConfigPayload {
  depthPerPixel?: number
  trackWidths?: Record<string, number>
}

export interface ViewStore {
  scrollDepth: number
  depthPerPixel: number
  visibleDepthRange: VisibleDepthRange
  cursorDepth: number | null
  selectedTrackId: string | null
  trackWidths: Record<string, number>
  viewportHeight: number
  setScroll: (depth: number) => void
  setScale: (dpp: number) => void
  setCursorDepth: (depth: number | null) => void
  selectTrack: (trackId: string | null) => void
  setViewportHeight: (height: number) => void
  setTrackWidth: (id: string, width: number) => void
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
const minimumTrackWidth = 80

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
  selectedTrackId: null,
  trackWidths: {},
  viewportHeight: initialViewportHeight,
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
  selectTrack(selectedTrackId) {
    set({ selectedTrackId })
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
  applyVisualConfig(config) {
    set((state) => {
      const nextDepthPerPixel = config.depthPerPixel ?? state.depthPerPixel
      return {
        depthPerPixel: nextDepthPerPixel,
        trackWidths: normalizeTrackWidths(config.trackWidths),
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
