import { create } from 'zustand'

import { DEPTH_TRACK_ID, FORMATION_TRACK_ID } from './workspaceStore'

interface VisibleDepthRange {
  min: number
  max: number
}

export type SubsidenceModelType = 'total' | 'decompaction' | 'airy' | 'stepwise' | 'thermal'
export type SeaLevelOverlayLineStyle = 'solid' | 'dashed' | 'dotted'

export interface SeaLevelOverlayStyle {
  colorHex: string
  lineStyle: SeaLevelOverlayLineStyle
}

export interface SubsidenceModelConfig {
  zoneSetId: number | null
}

const DEFAULT_MODEL_CONFIG: SubsidenceModelConfig = { zoneSetId: null }

const ALL_MODEL_TYPES: SubsidenceModelType[] = ['total', 'decompaction', 'airy', 'stepwise', 'thermal']

function defaultModelConfigs(): Record<SubsidenceModelType, SubsidenceModelConfig> {
  return Object.fromEntries(ALL_MODEL_TYPES.map((t) => [t, { ...DEFAULT_MODEL_CONFIG }])) as Record<SubsidenceModelType, SubsidenceModelConfig>
}

interface VisualConfigPayload {
  depthPerPixel?: number
  trackWidths?: Record<string, number>
  subsidenceWidth?: number
  depthTrackConfig?: Partial<DepthTrackConfig>
  formationsTrackConfig?: Partial<FormationsTrackConfig>
  subsidenceSingleDepthMin?: number | null
  subsidenceSingleDepthMax?: number | null
  subsidenceMultiDepthMin?: number | null
  subsidenceMultiDepthMax?: number | null
  activeSubsidenceModelType?: SubsidenceModelType
  subsidenceModelConfigs?: Partial<Record<SubsidenceModelType, Partial<SubsidenceModelConfig> & { seaLevelCurveId?: number | null }>>
  subsidenceSingleShowSeaLevel?: boolean
  subsidenceSingleSeaLevelOverlayCurveIds?: number[]
  seaLevelOverlayStyles?: Record<string, Partial<SeaLevelOverlayStyle>>
}

export type SelectedElementType = 'curve' | 'track' | 'formation'

export interface DepthTrackConfig {
  backgroundColor: string
  majorInterval: number
  minorInterval: number
  unit: 'm' | 'km' | 'ft'
  showHorizontalGrid: boolean
  gridColor: string
  labelColor: string
}

export interface FormationsTrackConfig {
  backgroundColor: string
  nameSource: 'formation-name' | 'linked-strat-unit'
  showLabels: boolean
  showMarkerLabels: boolean
  markerLabelPosition: 'left' | 'center' | 'right'
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
  depthType: 'MD' | 'TVD' | 'TVDSS'
  activePickId: string | null
  subsidenceSingleDepthMin: number | null
  subsidenceSingleDepthMax: number | null
  subsidenceMultiDepthMin: number | null
  subsidenceMultiDepthMax: number | null
  activeSubsidenceModelType: SubsidenceModelType
  subsidenceModelConfigs: Record<SubsidenceModelType, SubsidenceModelConfig>
  subsidenceSingleShowSeaLevel: boolean
  subsidenceSingleSeaLevelOverlayCurveIds: number[]
  seaLevelOverlayStyles: Record<number, SeaLevelOverlayStyle>
  setScroll: (depth: number) => void
  setScale: (dpp: number) => void
  setCursorDepth: (depth: number | null) => void
  setOverviewVisible: (visible: boolean) => void
  setCurveTooltipVisible: (visible: boolean) => void
  setInteractionMode: (mode: 'view' | 'edit-tops') => void
  setActivePickId: (id: string | null) => void
  updateDepthTrackConfig: (patch: Partial<DepthTrackConfig>) => void
  updateFormationsTrackConfig: (patch: Partial<FormationsTrackConfig>) => void
  selectTrack: (trackId: string | null) => void
  selectElement: (id: string, type: SelectedElementType) => void
  clearSelection: () => void
  setViewportHeight: (height: number) => void
  setTrackWidth: (id: string, width: number) => void
  setSubsidenceWidth: (width: number) => void
  setSubsidenceBottomHeight: (height: number) => void
  setDepthType: (t: 'MD' | 'TVD' | 'TVDSS') => void
  setSubsidenceSingleDepthMin: (v: number | null) => void
  setSubsidenceSingleDepthMax: (v: number | null) => void
  setSubsidenceMultiDepthMin: (v: number | null) => void
  setSubsidenceMultiDepthMax: (v: number | null) => void
  setActiveSubsidenceModelType: (t: SubsidenceModelType) => void
  updateSubsidenceModelConfig: (modelType: SubsidenceModelType, patch: Partial<SubsidenceModelConfig>) => void
  setSubsidenceSingleShowSeaLevel: (v: boolean) => void
  setSubsidenceSingleSeaLevelOverlayCurveIds: (ids: number[]) => void
  toggleSubsidenceSingleSeaLevelOverlayCurve: (id: number, visible: boolean) => void
  updateSeaLevelOverlayStyle: (id: number, patch: Partial<SeaLevelOverlayStyle>) => void
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
  showHorizontalGrid: true,
  gridColor: '#c4d0dc',
  labelColor: '#516273',
}
const initialFormationsTrackConfig: FormationsTrackConfig = {
  backgroundColor: '#ffffff',
  nameSource: 'formation-name',
  showLabels: true,
  showMarkerLabels: true,
  markerLabelPosition: 'left',
}

const SEA_LEVEL_OVERLAY_PALETTE = ['#0891b2', '#7c3aed', '#ea580c', '#16a34a', '#dc2626', '#2563eb']

function normalizeTrackWidths(trackWidths: Record<string, number> | undefined): Record<string, number> {
  if (!trackWidths) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(trackWidths).map(([id, width]) => [id, Math.max(minimumTrackWidth, Math.round(width))]),
  )
}

function normalizeCurveIds(ids: number[] | undefined): number[] {
  if (!ids) return []
  return Array.from(new Set(ids.filter((id) => Number.isFinite(id)).map((id) => Math.trunc(id)))).sort((a, b) => a - b)
}

export function defaultSeaLevelOverlayStyle(curveId: number): SeaLevelOverlayStyle {
  return {
    colorHex: SEA_LEVEL_OVERLAY_PALETTE[Math.abs(curveId) % SEA_LEVEL_OVERLAY_PALETTE.length],
    lineStyle: 'dashed',
  }
}

function normalizeSeaLevelOverlayStyles(
  styles: Record<string, Partial<SeaLevelOverlayStyle>> | undefined,
): Record<number, SeaLevelOverlayStyle> {
  if (!styles) return {}
  const next: Record<number, SeaLevelOverlayStyle> = {}
  for (const [rawId, rawStyle] of Object.entries(styles)) {
    const curveId = Number(rawId)
    if (!Number.isFinite(curveId)) continue
    const defaults = defaultSeaLevelOverlayStyle(curveId)
    const colorHex = typeof rawStyle.colorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawStyle.colorHex)
      ? rawStyle.colorHex
      : defaults.colorHex
    const lineStyle = rawStyle.lineStyle === 'solid' || rawStyle.lineStyle === 'dashed' || rawStyle.lineStyle === 'dotted'
      ? rawStyle.lineStyle
      : defaults.lineStyle
    next[curveId] = { colorHex, lineStyle }
  }
  return next
}

export const useViewStore = create<ViewStore>((set) => ({
  scrollDepth: initialScrollDepth,
  depthPerPixel: initialDepthPerPixel,
  visibleDepthRange: deriveVisibleDepthRange(initialScrollDepth, initialDepthPerPixel, initialViewportHeight),
  cursorDepth: null,
  overviewVisible: false,
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
  activePickId: null,
  subsidenceSingleDepthMin: null,
  subsidenceSingleDepthMax: null,
  subsidenceMultiDepthMin: null,
  subsidenceMultiDepthMax: null,
  activeSubsidenceModelType: 'total' as SubsidenceModelType,
  subsidenceModelConfigs: defaultModelConfigs(),
  subsidenceSingleShowSeaLevel: false,
  subsidenceSingleSeaLevelOverlayCurveIds: [],
  seaLevelOverlayStyles: {},
  lodEnabled: false,
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
    set({ interactionMode, ...(interactionMode === 'view' ? { activePickId: null } : {}) })
  },
  setActivePickId(activePickId) {
    set({ activePickId })
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
  setSubsidenceSingleDepthMin(v) { set({ subsidenceSingleDepthMin: v }) },
  setSubsidenceSingleDepthMax(v) { set({ subsidenceSingleDepthMax: v }) },
  setSubsidenceMultiDepthMin(v) { set({ subsidenceMultiDepthMin: v }) },
  setSubsidenceMultiDepthMax(v) { set({ subsidenceMultiDepthMax: v }) },
  setActiveSubsidenceModelType(t) { set({ activeSubsidenceModelType: t }) },
  setSubsidenceSingleShowSeaLevel(v) { set({ subsidenceSingleShowSeaLevel: v }) },
  setSubsidenceSingleSeaLevelOverlayCurveIds(ids) {
    const normalized = normalizeCurveIds(ids)
    set({
      subsidenceSingleSeaLevelOverlayCurveIds: normalized,
      subsidenceSingleShowSeaLevel: normalized.length > 0,
    })
  },
  toggleSubsidenceSingleSeaLevelOverlayCurve(id, visible) {
    set((state) => {
      const current = new Set(state.subsidenceSingleSeaLevelOverlayCurveIds)
      if (visible) current.add(id)
      else current.delete(id)
      const normalized = normalizeCurveIds(Array.from(current))
      return {
        subsidenceSingleSeaLevelOverlayCurveIds: normalized,
        subsidenceSingleShowSeaLevel: normalized.length > 0,
      }
    })
  },
  updateSeaLevelOverlayStyle(id, patch) {
    set((state) => {
      const current = state.seaLevelOverlayStyles[id] ?? defaultSeaLevelOverlayStyle(id)
      const nextStyle: SeaLevelOverlayStyle = {
        ...current,
        ...patch,
      }
      return {
        seaLevelOverlayStyles: {
          ...state.seaLevelOverlayStyles,
          [id]: nextStyle,
        },
      }
    })
  },
  updateSubsidenceModelConfig(modelType, patch) {
    set((state) => ({
      subsidenceModelConfigs: {
        ...state.subsidenceModelConfigs,
        [modelType]: { ...state.subsidenceModelConfigs[modelType], ...patch },
      },
    }))
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
      const mergedModelConfigs = { ...state.subsidenceModelConfigs }
      if (config.subsidenceModelConfigs) {
        for (const [key, val] of Object.entries(config.subsidenceModelConfigs)) {
          if (val && key in mergedModelConfigs) {
            const modelType = key as SubsidenceModelType
            mergedModelConfigs[modelType] = {
              ...mergedModelConfigs[modelType],
              zoneSetId: val.zoneSetId ?? mergedModelConfigs[modelType].zoneSetId,
            }
          }
        }
      }
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
        subsidenceSingleDepthMin: 'subsidenceSingleDepthMin' in config ? config.subsidenceSingleDepthMin ?? null : state.subsidenceSingleDepthMin,
        subsidenceSingleDepthMax: 'subsidenceSingleDepthMax' in config ? config.subsidenceSingleDepthMax ?? null : state.subsidenceSingleDepthMax,
        subsidenceMultiDepthMin: 'subsidenceMultiDepthMin' in config ? config.subsidenceMultiDepthMin ?? null : state.subsidenceMultiDepthMin,
        subsidenceMultiDepthMax: 'subsidenceMultiDepthMax' in config ? config.subsidenceMultiDepthMax ?? null : state.subsidenceMultiDepthMax,
        activeSubsidenceModelType: config.activeSubsidenceModelType ?? state.activeSubsidenceModelType,
        subsidenceModelConfigs: mergedModelConfigs,
        subsidenceSingleShowSeaLevel: config.subsidenceSingleShowSeaLevel ?? state.subsidenceSingleShowSeaLevel,
        subsidenceSingleSeaLevelOverlayCurveIds: normalizeCurveIds(config.subsidenceSingleSeaLevelOverlayCurveIds ?? state.subsidenceSingleSeaLevelOverlayCurveIds),
        seaLevelOverlayStyles: config.seaLevelOverlayStyles
          ? normalizeSeaLevelOverlayStyles(config.seaLevelOverlayStyles)
          : state.seaLevelOverlayStyles,
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
      activePickId: null,
      subsidenceSingleDepthMin: null,
      subsidenceSingleDepthMax: null,
      subsidenceMultiDepthMin: null,
      subsidenceMultiDepthMax: null,
      activeSubsidenceModelType: 'total',
      subsidenceModelConfigs: defaultModelConfigs(),
      subsidenceSingleShowSeaLevel: false,
      subsidenceSingleSeaLevelOverlayCurveIds: [],
      seaLevelOverlayStyles: {},
      visibleDepthRange: deriveVisibleDepthRange(state.scrollDepth, initialDepthPerPixel, state.viewportHeight),
    }))
  },
}))
