import { create } from 'zustand'

interface VisibleDepthRange {
  min: number
  max: number
}

export interface ViewStore {
  scrollDepth: number
  depthPerPixel: number
  visibleDepthRange: VisibleDepthRange
  cursorDepth: number | null
  trackWidths: Record<string, number>
  viewportHeight: number
  setScroll: (depth: number) => void
  setScale: (dpp: number) => void
  setCursorDepth: (depth: number | null) => void
  setViewportHeight: (height: number) => void
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

export const useViewStore = create<ViewStore>((set) => ({
  scrollDepth: initialScrollDepth,
  depthPerPixel: initialDepthPerPixel,
  visibleDepthRange: deriveVisibleDepthRange(initialScrollDepth, initialDepthPerPixel, initialViewportHeight),
  cursorDepth: null,
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
  setViewportHeight(viewportHeight) {
    set((state) => ({
      viewportHeight,
      visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, state.depthPerPixel, viewportHeight),
    }))
  },
}))
