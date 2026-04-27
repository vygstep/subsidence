import { create } from 'zustand'

import type {
  CompactionModel,
  CompactionPresetDetail,
  CompactionPresetSummary,
  CurveData,
  CurveMnemonicEntryItem,
  CurveMnemonicSetDetail,
  CurveMnemonicSetSummary,
  FormationTop,
  FormationZone,
  LithologyDictionaryEntry,
  LithologyPatternEntry,
  LithologyPatternPaletteDetail,
  LithologyPatternPaletteSummary,
  LithologySetDetail,
  LithologySetSummary,
  LithologyParam,
  SeaLevelCurve,
  StratChartInfo,
  UnitDimensionDetail,
  UnitDimensionSummary,
  Well,
  WellInventory,
} from '@/types'
import { minCurvatureToTVD, type TVDTable } from '@/utils/depthTransform'
import { recordOperation } from '@/utils/diagnostics'

interface CurveResponse {
  mnemonic: string
  unit: string
  depths: number[]
  values: number[]
  null_value: number
  curve_type?: 'continuous' | 'discrete'
  discrete_code_map?: Record<string, string> | null
}

interface WellResponse extends Well {
  curves: CurveResponse[]
  formations: FormationTop[]
}

interface FormationResponse {
  id: string
  name: string
  depth_md: number | null
  depth_tvd: number | null
  depth_tvdss: number | null
  horizon_id: number | null
  age_ma?: number
  color: string
  kind: string
  is_locked: boolean
  water_depth_m: number
  eroded_thickness_m: number
  lithology?: FormationTop['lithology']
  strat_links: FormationTop['strat_links']
  active_strat_color: string | null
  active_strat_unit_name: string | null
}

interface FormationCreatePayload {
  name: string
  depth_md: number
  color?: string
  kind?: string
  lithology?: FormationTop['lithology']
  age_ma?: number
  is_locked?: boolean
}

interface FormationPatchPayload {
  name?: string
  depth_md?: number
  depth_tvd?: number
  depth_tvdss?: number
  color?: string
  kind?: string
  lithology?: FormationTop['lithology']
  age_ma?: number
  is_locked?: boolean
  water_depth_m?: number
  eroded_thickness_m?: number
}

export interface WellDataStore {
  well: Well | null
  wellInventories: WellInventory[]
  curves: CurveData[]
  formations: FormationTop[]
  zones: FormationZone[]
  colorOverrides: Record<string, string>
  stratCharts: StratChartInfo[]
  compactionModels: CompactionModel[]
  compactionPresets: CompactionPresetSummary[]
  mnemonicSets: CurveMnemonicSetSummary[]
  unitDimensions: UnitDimensionSummary[]
  lithologyDictionaryEntries: LithologyDictionaryEntry[]
  lithologySets: LithologySetSummary[]
  lithologyPatternPalettes: LithologyPatternPaletteSummary[]
  tvdTable: TVDTable | null
  isLoading: boolean
  error: string | null
  reset: () => void
  setColorOverrides: (overrides: Record<string, string>) => void
  loadWellInventories: () => Promise<boolean>
  loadWell: (wellId: string) => Promise<void>
  refreshWell: (preferredWellId?: string) => Promise<void>
  addFormation: (formation: FormationCreatePayload) => Promise<void>
  updateFormation: (formationId: string, patch: FormationPatchPayload) => Promise<void>
  updateFormationDepth: (formationId: string, depth: number) => Promise<void>
  removeFormation: (formationId: string) => Promise<void>
  loadStratCharts: () => Promise<void>
  activateChart: (chartId: number) => Promise<void>
  deleteChart: (chartId: number) => Promise<void>
  linkFormationToChart: (formationId: string, chartId: number, stratUnitId: number | null) => Promise<void>
  loadCompactionModels: () => Promise<void>
  loadCompactionPresets: () => Promise<void>
  createCompactionModel: (name: string, cloneFromId?: number) => Promise<CompactionModel>
  activateCompactionModel: (id: number) => Promise<void>
  renameCompactionModel: (id: number, name: string) => Promise<void>
  deleteCompactionModel: (id: number) => Promise<void>
  fetchCompactionPreset: (presetId: number) => Promise<CompactionPresetDetail | null>
  createCompactionPreset: (payload: {
    name?: string
    cloneFromId?: number
    description?: string | null
    density?: number
    porosity_surface?: number
    compaction_coeff?: number
  }) => Promise<CompactionPresetDetail>
  updateCompactionPreset: (presetId: number, patch: {
    name?: string
    description?: string | null
    density?: number
    porosity_surface?: number
    compaction_coeff?: number
  }) => Promise<CompactionPresetDetail>
  deleteCompactionPreset: (presetId: number) => Promise<void>
  loadMnemonicSets: () => Promise<void>
  fetchMnemonicSet: (setId: number) => Promise<CurveMnemonicSetDetail | null>
  createMnemonicSet: (name: string) => Promise<CurveMnemonicSetSummary>
  copyMnemonicSet: (setId: number) => Promise<CurveMnemonicSetSummary>
  updateMnemonicSet: (setId: number, patch: { name?: string }) => Promise<CurveMnemonicSetSummary>
  deleteMnemonicSet: (setId: number) => Promise<void>
  createMnemonicSetEntry: (setId: number) => Promise<CurveMnemonicEntryItem>
  updateMnemonicSetEntry: (
    setId: number,
    entryId: number,
    patch: {
      pattern?: string
      is_regex?: boolean
      priority?: number
      family_code?: string | null
      canonical_mnemonic?: string | null
      canonical_unit?: string | null
      is_active?: boolean
    },
  ) => Promise<CurveMnemonicEntryItem>
  deleteMnemonicSetEntry: (setId: number, entryId: number) => Promise<void>
  loadUnitDimensions: () => Promise<void>
  fetchUnitDimension: (dimensionCode: string) => Promise<UnitDimensionDetail | null>
  loadLithologyDictionary: () => Promise<void>
  loadLithologySets: () => Promise<void>
  loadLithologyPatternPalettes: () => Promise<void>
  fetchLithologyPatternPalette: (paletteId: number) => Promise<LithologyPatternPaletteDetail | null>
  createLithologyPatternPalette: (name: string, cloneFromId?: number) => Promise<LithologyPatternPaletteSummary>
  updateLithologyPatternPalette: (paletteId: number, patch: { name?: string; description?: string | null }) => Promise<LithologyPatternPaletteSummary>
  deleteLithologyPatternPalette: (paletteId: number) => Promise<void>
  importLithologyPattern: (
    paletteId: number,
    payload: { path: string; code?: string | null; display_name?: string | null; description?: string | null },
  ) => Promise<LithologyPatternEntry>
  deleteLithologyPattern: (paletteId: number, patternId: number) => Promise<void>
  fetchLithologySet: (setId: number) => Promise<LithologySetDetail | null>
  createLithologySet: (name: string) => Promise<LithologySetSummary>
  copyLithologySet: (setId: number) => Promise<LithologySetSummary>
  updateLithologySet: (setId: number, patch: { name?: string }) => Promise<LithologySetSummary>
  deleteLithologySet: (setId: number) => Promise<void>
  createLithologySetEntry: (setId: number) => Promise<LithologySetDetail['entries'][number]>
  updateLithologySetEntry: (
    setId: number,
    entryId: number,
    patch: {
      lithology_code?: string
      display_name?: string
      color_hex?: string
      pattern_id?: string | null
      compaction_preset_id?: number | null
    },
  ) => Promise<LithologySetDetail['entries'][number]>
  deleteLithologySetEntry: (setId: number, entryId: number) => Promise<void>
  fetchCompactionModelParams: (modelId: number) => Promise<LithologyParam[]>
  updateCompactionModelParam: (modelId: number, lithologyCode: string, patch: Partial<Pick<LithologyParam, 'density' | 'porosity_surface' | 'compaction_coeff'>>) => Promise<LithologyParam>
  fetchCurvesLOD: (depthMin: number, depthMax: number, resolution: number) => Promise<void>
  reloadCurvesForDepthBasis: (depthBasis: 'MD' | 'TVD' | 'TVDSS') => Promise<void>
  updateZoneLithology: (zoneId: number, lithologyFractions: string | null, lithologySource: 'manual' | 'auto') => Promise<void>
  loadSeaLevelCurves: () => Promise<SeaLevelCurve[]>
  setWellActiveSeaLevelCurve: (wellId: string, curveId: number | null) => Promise<void>
}

function toFloat32Array(values: number[]): Float32Array {
  return new Float32Array(values)
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) {
      return payload.detail
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback
}

function sortFormations(formations: FormationTop[]): FormationTop[] {
  return [...formations].sort((left, right) => (left.depth_md ?? Infinity) - (right.depth_md ?? Infinity))
}

function mapFormation(row: FormationResponse): FormationTop {
  return {
    id: row.id,
    name: row.name,
    depth_md: row.depth_md,
    depth_tvd: row.depth_tvd ?? null,
    depth_tvdss: row.depth_tvdss ?? null,
    horizon_id: row.horizon_id ?? null,
    age_ma: row.age_ma,
    color: row.color,
    kind: row.kind,
    is_locked: row.is_locked,
    water_depth_m: row.water_depth_m ?? 0,
    eroded_thickness_m: row.eroded_thickness_m ?? 0,
    lithology: row.lithology,
    strat_links: row.strat_links ?? [],
    active_strat_color: row.active_strat_color,
    active_strat_unit_name: row.active_strat_unit_name,
  }
}

async function fetchFormations(wellId: string): Promise<FormationResponse[]> {
  const response = await fetch(`/api/wells/${wellId}/formations`)
  if (!response.ok) {
    throw new Error(await readError(response, `Failed to load formations for '${wellId}' (${response.status})`))
  }
  return (await response.json()) as FormationResponse[]
}

const pendingDepthPatches = new Map<string, number>()

function clearPendingDepthPatches(): void {
  for (const timeoutId of pendingDepthPatches.values()) {
    window.clearTimeout(timeoutId)
  }
  pendingDepthPatches.clear()
}

const emptyState = {
  well: null,
  wellInventories: [] as WellInventory[],
  curves: [] as CurveData[],
  formations: [] as FormationTop[],
  zones: [] as FormationZone[],
  colorOverrides: {} as Record<string, string>,
  stratCharts: [] as StratChartInfo[],
  compactionModels: [] as CompactionModel[],
  compactionPresets: [] as CompactionPresetSummary[],
  mnemonicSets: [] as CurveMnemonicSetSummary[],
  unitDimensions: [] as UnitDimensionSummary[],
  lithologyDictionaryEntries: [] as LithologyDictionaryEntry[],
  lithologySets: [] as LithologySetSummary[],
  lithologyPatternPalettes: [] as LithologyPatternPaletteSummary[],
  tvdTable: null as TVDTable | null,
  isLoading: false,
  error: null as string | null,
}

export const useWellDataStore = create<WellDataStore>((set, get) => ({
  ...emptyState,
  reset() {
    clearPendingDepthPatches()
    set(emptyState)
  },
  setColorOverrides(overrides) {
    set({ colorOverrides: overrides })
  },
  async loadWellInventories() {
    try {
      const response = await fetch('/api/wells/inventory')
      if (!response.ok) {
        throw new Error(await readError(response, `Failed to load well inventories (${response.status})`))
      }
      const payload = (await response.json()) as WellInventory[]
      const activeWellId = get().well?.well_id
      const activeInventory = activeWellId ? payload.find((w) => w.well_id === activeWellId) : null
      set({ wellInventories: payload, zones: activeInventory?.zones ?? [], error: null })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' })
      return false
    }
  },
  async loadWell(wellId: string) {
    clearPendingDepthPatches()
    set({ isLoading: true, error: null })

    try {
      const [wellResponse, formationPayload] = await Promise.all([
        fetch(`/api/wells/${wellId}`),
        fetchFormations(wellId),
      ])
      if (!wellResponse.ok) {
        throw new Error(await readError(wellResponse, `Failed to load well '${wellId}' (${wellResponse.status})`))
      }

      const payload = (await wellResponse.json()) as WellResponse
      const { curves, ...well } = payload

      set({
        well,
        curves: curves.map((curve) => ({
          mnemonic: curve.mnemonic,
          unit: curve.unit,
          depths: toFloat32Array(curve.depths),
          values: toFloat32Array(curve.values),
          null_value: curve.null_value,
          curve_type: curve.curve_type ?? 'continuous',
          discrete_code_map: curve.discrete_code_map ?? null,
        })),
        formations: sortFormations(formationPayload.map(mapFormation)),
        tvdTable: null,
        isLoading: false,
        error: null,
      })

      // Load TVD table if INCL_AZIM deviation survey exists
      if (well.deviation?.mode === 'INCL_AZIM') {
        try {
          const devResponse = await fetch(`/api/wells/${wellId}/deviation`)
          if (devResponse.ok) {
            const devData = (await devResponse.json()) as {
              md: number[]
              inclination_deg: number[]
              azimuth_deg: number[]
            }
            const survey = devData.md.map((md, i) => ({
              md,
              inclination_deg: devData.inclination_deg[i],
              azimuth_deg: devData.azimuth_deg[i],
            }))
            set({ tvdTable: minCurvatureToTVD(survey) })
          }
        } catch {
          // TVD is optional — silently ignore fetch errors
        }
      }

      await get().loadWellInventories()
      const { useComputedStore } = await import('./computedStore')
      useComputedStore.getState().triggerRecalculation()
    } catch (error) {
      const inventories = get().wellInventories
      set({
        ...emptyState,
        wellInventories: inventories,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
  async addFormation(formation) {
    const wellId = get().well?.well_id
    if (!wellId) {
      throw new Error('No well is currently loaded')
    }

    const response = await fetch(`/api/wells/${wellId}/formations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formation),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to add formation (${response.status})`))
    }

    const created = mapFormation((await response.json()) as FormationResponse)
    set((state) => ({
      formations: sortFormations([...state.formations, created]),
      error: null,
    }))
    await get().loadWellInventories()
    const { useComputedStore } = await import('./computedStore')
    useComputedStore.getState().triggerRecalculation()
  },
  async updateFormation(formationId, patch) {
    const wellId = get().well?.well_id
    if (!wellId) {
      throw new Error('No well is currently loaded')
    }

    const response = await fetch(`/api/wells/${wellId}/formations/${formationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update formation '${formationId}' (${response.status})`))
    }

    const updated = mapFormation((await response.json()) as FormationResponse)
    set((state) => ({
      formations: sortFormations(
        state.formations.map((formation) => (
          formation.id === formationId ? updated : formation
        )),
      ),
      error: null,
    }))
    await get().loadWellInventories()
    const { useComputedStore } = await import('./computedStore')
    useComputedStore.getState().triggerRecalculation()
  },
  async updateFormationDepth(formationId, depth) {
    const wellId = get().well?.well_id
    if (!wellId) {
      throw new Error('No well is currently loaded')
    }

    set((state) => ({
      formations: sortFormations(
        state.formations.map((formation) => (
          formation.id === formationId
            ? { ...formation, depth_md: depth }
            : formation
        )),
      ),
      error: null,
    }))

    const pending = pendingDepthPatches.get(formationId)
    if (pending !== undefined) {
      window.clearTimeout(pending)
    }

    const timeoutId = window.setTimeout(() => {
      void fetch(`/api/wells/${wellId}/formations/${formationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depth_md: depth }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await readError(response, `Failed to update formation '${formationId}' (${response.status})`))
          }
          const updated = mapFormation((await response.json()) as FormationResponse)
          set((state) => ({
            formations: sortFormations(
              state.formations.map((formation) => (
                formation.id === formationId ? updated : formation
              )),
            ),
            error: null,
          }))
          await get().loadWellInventories()
          const { useProjectStore } = await import('./projectStore')
          await useProjectStore.getState().pollStatus()
          const { useComputedStore } = await import('./computedStore')
          useComputedStore.getState().triggerRecalculation()
        })
        .catch((error) => {
          set({ error: error instanceof Error ? error.message : 'Unknown error' })
        })
        .finally(() => {
          pendingDepthPatches.delete(formationId)
        })
    }, 300)

    pendingDepthPatches.set(formationId, timeoutId)
  },
  async removeFormation(formationId) {
    const wellId = get().well?.well_id
    if (!wellId) {
      throw new Error('No well is currently loaded')
    }

    const response = await fetch(`/api/wells/${wellId}/formations/${formationId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete formation '${formationId}' (${response.status})`))
    }

    set((state) => ({
      formations: state.formations.filter((formation) => formation.id !== formationId),
      error: null,
    }))
    await get().loadWellInventories()
    const { useComputedStore } = await import('./computedStore')
    useComputedStore.getState().triggerRecalculation()
  },
  async loadStratCharts() {
    const response = await fetch('/api/strat-charts')
    if (!response.ok) return
    const charts = (await response.json()) as StratChartInfo[]
    set({ stratCharts: charts })
  },
  async activateChart(chartId) {
    await recordOperation('strat_chart.activate', async () => {
      const response = await fetch(`/api/strat-charts/${chartId}/activate`, { method: 'PATCH' })
      if (!response.ok) return
      const updated = (await response.json()) as StratChartInfo
      set((state) => ({
        stratCharts: state.stratCharts.map((c) => ({
          ...c,
          is_active: c.id === updated.id,
        })),
      }))
      // Refresh formations to pick up new active strat colors
      const wellId = get().well?.well_id
      if (wellId) {
        const formations = await fetchFormations(wellId)
        set({ formations: sortFormations(formations.map(mapFormation)) })
      }
    }, { activeWellId: get().well?.well_id, details: { chartId } })
  },
  async deleteChart(chartId) {
    await recordOperation('strat_chart.delete', async () => {
      const response = await fetch(`/api/strat-charts/${chartId}`, { method: 'DELETE' })
      if (!response.ok) return
      set((state) => ({ stratCharts: state.stratCharts.filter((c) => c.id !== chartId) }))
      // Refresh formations
      const wellId = get().well?.well_id
      if (wellId) {
        const formations = await fetchFormations(wellId)
        set({ formations: sortFormations(formations.map(mapFormation)) })
      }
    }, { activeWellId: get().well?.well_id, details: { chartId } })
  },
  async refreshWell(preferredWellId) {
    await get().loadWellInventories()
    const wells = get().wellInventories
    if (wells.length === 0) {
      get().reset()
      return
    }
    const currentWellId = get().well?.well_id
    const hasCurrent = currentWellId ? wells.some((w) => w.well_id === currentWellId) : false
    const nextWellId = preferredWellId ?? (hasCurrent ? currentWellId : wells[0].well_id)
    if (!nextWellId) {
      get().reset()
      return
    }
    if (preferredWellId || nextWellId !== currentWellId) {
      await get().loadWell(nextWellId)
    }
  },
  async loadCompactionModels() {
    const response = await fetch('/api/compaction-models')
    if (!response.ok) return
    set({ compactionModels: (await response.json()) as CompactionModel[] })
  },
  async loadCompactionPresets() {
    const response = await fetch('/api/compaction-presets')
    if (!response.ok) return
    set({ compactionPresets: (await response.json()) as CompactionPresetSummary[] })
  },
  async loadMnemonicSets() {
    const response = await fetch('/api/mnemonic-sets')
    if (!response.ok) return
    set({ mnemonicSets: (await response.json()) as CurveMnemonicSetSummary[] })
  },
  async fetchMnemonicSet(setId) {
    const response = await fetch(`/api/mnemonic-sets/${setId}`)
    if (!response.ok) return null
    return (await response.json()) as CurveMnemonicSetDetail
  },
  async createMnemonicSet(name) {
    const response = await fetch('/api/mnemonic-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to create mnemonic set (${response.status})`))
    }
    const created = (await response.json()) as CurveMnemonicSetSummary
    set((state) => ({ mnemonicSets: [...state.mnemonicSets, created] }))
    return created
  },
  async copyMnemonicSet(setId) {
    const response = await fetch(`/api/mnemonic-sets/${setId}/copy`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to copy mnemonic set (${response.status})`))
    }
    const created = (await response.json()) as CurveMnemonicSetSummary
    set((state) => ({ mnemonicSets: [...state.mnemonicSets, created] }))
    return created
  },
  async updateMnemonicSet(setId, patch) {
    const response = await fetch(`/api/mnemonic-sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update mnemonic set (${response.status})`))
    }
    const updated = (await response.json()) as CurveMnemonicSetSummary
    set((state) => ({
      mnemonicSets: state.mnemonicSets.map((row) => (row.id === updated.id ? updated : row)),
    }))
    return updated
  },
  async deleteMnemonicSet(setId) {
    const response = await fetch(`/api/mnemonic-sets/${setId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete mnemonic set (${response.status})`))
    }
    set((state) => ({
      mnemonicSets: state.mnemonicSets.filter((row) => row.id !== setId),
    }))
  },
  async createMnemonicSetEntry(setId) {
    const response = await fetch(`/api/mnemonic-sets/${setId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to add mnemonic row (${response.status})`))
    }
    const created = (await response.json()) as CurveMnemonicEntryItem
    set((state) => ({
      mnemonicSets: state.mnemonicSets.map((row) => (
        row.id === setId
          ? { ...row, entry_count: row.entry_count + 1 }
          : row
      )),
    }))
    return created
  },
  async updateMnemonicSetEntry(setId, entryId, patch) {
    const response = await fetch(`/api/mnemonic-sets/${setId}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update mnemonic row (${response.status})`))
    }
    return (await response.json()) as CurveMnemonicEntryItem
  },
  async deleteMnemonicSetEntry(setId, entryId) {
    const response = await fetch(`/api/mnemonic-sets/${setId}/entries/${entryId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete mnemonic row (${response.status})`))
    }
    set((state) => ({
      mnemonicSets: state.mnemonicSets.map((row) => (
        row.id === setId
          ? { ...row, entry_count: Math.max(0, row.entry_count - 1) }
          : row
      )),
    }))
  },
  async loadUnitDimensions() {
    const response = await fetch('/api/unit-dimensions')
    if (!response.ok) return
    set({ unitDimensions: (await response.json()) as UnitDimensionSummary[] })
  },
  async fetchUnitDimension(dimensionCode) {
    const response = await fetch(`/api/unit-dimensions/${encodeURIComponent(dimensionCode)}`)
    if (!response.ok) return null
    return (await response.json()) as UnitDimensionDetail
  },
  async loadLithologyDictionary() {
    const response = await fetch('/api/lithology-dictionary')
    if (!response.ok) return
    set({ lithologyDictionaryEntries: (await response.json()) as LithologyDictionaryEntry[] })
  },
  async loadLithologySets() {
    const response = await fetch('/api/lithology-sets')
    if (!response.ok) return
    set({ lithologySets: (await response.json()) as LithologySetSummary[] })
  },
  async loadLithologyPatternPalettes() {
    const response = await fetch('/api/lithology-pattern-palettes')
    if (!response.ok) return
    set({ lithologyPatternPalettes: (await response.json()) as LithologyPatternPaletteSummary[] })
  },
  async fetchLithologyPatternPalette(paletteId) {
    const response = await fetch(`/api/lithology-pattern-palettes/${paletteId}`)
    if (!response.ok) return null
    return (await response.json()) as LithologyPatternPaletteDetail
  },
  async createLithologyPatternPalette(name, cloneFromId) {
    const response = await fetch('/api/lithology-pattern-palettes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, clone_from_id: cloneFromId ?? null }),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to create pattern palette (${response.status})`))
    }
    const created = (await response.json()) as LithologyPatternPaletteSummary
    set((state) => ({ lithologyPatternPalettes: [...state.lithologyPatternPalettes, created] }))
    return created
  },
  async updateLithologyPatternPalette(paletteId, patch) {
    const response = await fetch(`/api/lithology-pattern-palettes/${paletteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update pattern palette (${response.status})`))
    }
    const updated = (await response.json()) as LithologyPatternPaletteSummary
    set((state) => ({
      lithologyPatternPalettes: state.lithologyPatternPalettes.map((row) => (row.id === updated.id ? updated : row)),
    }))
    return updated
  },
  async deleteLithologyPatternPalette(paletteId) {
    const response = await fetch(`/api/lithology-pattern-palettes/${paletteId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete pattern palette (${response.status})`))
    }
    set((state) => ({
      lithologyPatternPalettes: state.lithologyPatternPalettes.filter((row) => row.id !== paletteId),
    }))
  },
  async importLithologyPattern(paletteId, payload) {
    const response = await fetch(`/api/lithology-pattern-palettes/${paletteId}/patterns/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to import lithology pattern (${response.status})`))
    }
    const created = (await response.json()) as LithologyPatternEntry
    set((state) => ({
      lithologyPatternPalettes: state.lithologyPatternPalettes.map((row) => (
        row.id === paletteId ? { ...row, entry_count: row.entry_count + 1 } : row
      )),
    }))
    return created
  },
  async deleteLithologyPattern(paletteId, patternId) {
    const response = await fetch(`/api/lithology-pattern-palettes/${paletteId}/patterns/${patternId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete lithology pattern (${response.status})`))
    }
    set((state) => ({
      lithologyPatternPalettes: state.lithologyPatternPalettes.map((row) => (
        row.id === paletteId ? { ...row, entry_count: Math.max(0, row.entry_count - 1) } : row
      )),
    }))
  },
  async createLithologySet(name) {
    const response = await fetch('/api/lithology-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to create lithology set (${response.status})`))
    }
    const created = (await response.json()) as LithologySetSummary
    set((state) => ({ lithologySets: [...state.lithologySets, created] }))
    return created
  },
  async copyLithologySet(setId) {
    const response = await fetch(`/api/lithology-sets/${setId}/copy`, { method: 'POST' })
    if (response.ok) {
      const created = (await response.json()) as LithologySetSummary
      set((state) => ({ lithologySets: [...state.lithologySets, created] }))
      return created
    }

    if (response.status === 404 || response.status === 405) {
      const source = await get().fetchLithologySet(setId)
      if (!source) {
        throw new Error('Source lithology set was not found')
      }
      const created = await get().createLithologySet(`${source.name} Copy`)
      for (const entry of source.entries) {
        const added = await fetch(`/api/lithology-sets/${created.id}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lithology_code: entry.lithology_code,
            display_name: entry.display_name,
            color_hex: entry.color_hex,
            pattern_id: entry.pattern_id,
            compaction_preset_id: entry.compaction_preset_id,
          }),
        })
        if (!added.ok) {
          throw new Error(await readError(added, `Failed to copy lithology row (${added.status})`))
        }
      }
      await get().loadLithologySets()
      return created
    }

    throw new Error(await readError(response, `Failed to copy lithology set (${response.status})`))
  },
  async updateLithologySet(setId, patch) {
    const response = await fetch(`/api/lithology-sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update lithology set (${response.status})`))
    }
    const updated = (await response.json()) as LithologySetSummary
    set((state) => ({
      lithologySets: state.lithologySets.map((row) => (row.id === updated.id ? updated : row)),
    }))
    return updated
  },
  async deleteLithologySet(setId) {
    const response = await fetch(`/api/lithology-sets/${setId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete lithology set (${response.status})`))
    }
    set((state) => ({
      lithologySets: state.lithologySets.filter((row) => row.id !== setId),
    }))
  },
  async createCompactionModel(name, cloneFromId) {
    const response = await fetch('/api/compaction-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, clone_from_id: cloneFromId ?? null }),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to create compaction preset (${response.status})`))
    }
    const created = (await response.json()) as CompactionModel
    set((state) => ({ compactionModels: [...state.compactionModels, created] }))
    return created
  },
  async activateCompactionModel(id) {
    const response = await fetch(`/api/compaction-models/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    })
    if (!response.ok) return
    const updated = (await response.json()) as CompactionModel
    set((state) => ({
      compactionModels: state.compactionModels.map((m) => ({
        ...m,
        is_active: m.id === updated.id,
      })),
    }))
    const { useComputedStore } = await import('./computedStore')
    useComputedStore.getState().triggerRecalculation()
  },
  async renameCompactionModel(id, name) {
    const response = await fetch(`/api/compaction-models/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) return
    const updated = (await response.json()) as CompactionModel
    set((state) => ({
      compactionModels: state.compactionModels.map((m) => (m.id === updated.id ? updated : m)),
    }))
  },
  async deleteCompactionModel(id) {
    const response = await fetch(`/api/compaction-models/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete compaction preset (${response.status})`))
    }
    set((state) => ({ compactionModels: state.compactionModels.filter((m) => m.id !== id) }))
  },
  async fetchCompactionPreset(presetId) {
    const response = await fetch(`/api/compaction-presets/${presetId}`)
    if (!response.ok) return null
    return (await response.json()) as CompactionPresetDetail
  },
  async createCompactionPreset(payload) {
    const response = await fetch('/api/compaction-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        clone_from_id: payload.cloneFromId ?? null,
        description: payload.description ?? null,
        density: payload.density,
        porosity_surface: payload.porosity_surface,
        compaction_coeff: payload.compaction_coeff,
      }),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to create compaction preset (${response.status})`))
    }
    const created = (await response.json()) as CompactionPresetDetail
    set((state) => ({
      compactionPresets: [...state.compactionPresets, {
        id: created.id,
        name: created.name,
        origin: created.origin,
        is_builtin: created.is_builtin,
        source_lithology_code: created.source_lithology_code,
      }],
    }))
    return created
  },
  async updateCompactionPreset(presetId, patch) {
    const response = await fetch(`/api/compaction-presets/${presetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update compaction preset (${response.status})`))
    }
    const updated = (await response.json()) as CompactionPresetDetail
    set((state) => ({
      compactionPresets: state.compactionPresets.map((preset) => (
        preset.id === updated.id
          ? {
            id: updated.id,
            name: updated.name,
            origin: updated.origin,
            is_builtin: updated.is_builtin,
            source_lithology_code: updated.source_lithology_code,
          }
          : preset
      )),
    }))
    return updated
  },
  async deleteCompactionPreset(presetId) {
    const response = await fetch(`/api/compaction-presets/${presetId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete compaction preset (${response.status})`))
    }
    set((state) => ({
      compactionPresets: state.compactionPresets.filter((preset) => preset.id !== presetId),
    }))
  },
  async fetchLithologySet(setId) {
    const response = await fetch(`/api/lithology-sets/${setId}`)
    if (!response.ok) return null
    return (await response.json()) as LithologySetDetail
  },
  async createLithologySetEntry(setId) {
    const response = await fetch(`/api/lithology-sets/${setId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to add lithology row (${response.status})`))
    }
    const created = (await response.json()) as LithologySetDetail['entries'][number]
    set((state) => ({
      lithologySets: state.lithologySets.map((row) => (
        row.id === setId
          ? { ...row, entry_count: row.entry_count + 1 }
          : row
      )),
    }))
    return created
  },
  async updateLithologySetEntry(setId, entryId, patch) {
    const response = await fetch(`/api/lithology-sets/${setId}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update lithology row (${response.status})`))
    }
    return (await response.json()) as LithologySetDetail['entries'][number]
  },
  async deleteLithologySetEntry(setId, entryId) {
    const response = await fetch(`/api/lithology-sets/${setId}/entries/${entryId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to delete lithology row (${response.status})`))
    }
    set((state) => ({
      lithologySets: state.lithologySets.map((row) => (
        row.id === setId
          ? { ...row, entry_count: Math.max(0, row.entry_count - 1) }
          : row
      )),
    }))
  },
  async fetchCompactionModelParams(modelId) {
    const response = await fetch(`/api/compaction-models/${modelId}/params`)
    if (!response.ok) return []
    return (await response.json()) as LithologyParam[]
  },
  async updateCompactionModelParam(modelId, lithologyCode, patch) {
    const response = await fetch(`/api/compaction-models/${modelId}/params/${lithologyCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update param (${response.status})`))
    }
    return (await response.json()) as LithologyParam
  },
  async fetchCurvesLOD(depthMin, depthMax, resolution) {
    const wellId = get().well?.well_id
    if (!wellId) return
    const url = `/api/wells/${wellId}/curves?depth_min=${depthMin}&depth_max=${depthMax}&resolution=${resolution}`
    const response = await fetch(url)
    if (!response.ok) return
    const lodCurves = (await response.json()) as WellResponse['curves']
    const lodByMnemonic = new Map(lodCurves.map((c) => [c.mnemonic, c]))
    set((state) => ({
      curves: state.curves.map((curve) => {
        const lod = lodByMnemonic.get(curve.mnemonic)
        if (!lod) return curve
        return {
          ...curve,
          depths: toFloat32Array(lod.depths),
          values: toFloat32Array(lod.values),
        }
      }),
    }))
  },
  async reloadCurvesForDepthBasis(depthBasis) {
    const wellId = get().well?.well_id
    if (!wellId) return
    const url = `/api/wells/${wellId}/curves/full?depth_basis=${depthBasis}`
    const response = await fetch(url)
    if (!response.ok) return
    const fullCurves = (await response.json()) as WellResponse['curves']
    set({
      curves: fullCurves.map((curve) => ({
        mnemonic: curve.mnemonic,
        unit: curve.unit,
        depths: toFloat32Array(curve.depths),
        values: toFloat32Array(curve.values),
        null_value: curve.null_value,
        curve_type: curve.curve_type ?? 'continuous',
        discrete_code_map: curve.discrete_code_map ?? null,
      })),
    })
  },
  async linkFormationToChart(formationId, chartId, stratUnitId) {
    const wellId = get().well?.well_id
    if (!wellId) return

    const response = await fetch(`/api/wells/${wellId}/formations/${formationId}/strat-link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart_id: chartId, strat_unit_id: stratUnitId }),
    })
    if (!response.ok) return

    const updated = mapFormation((await response.json()) as FormationResponse)
    set((state) => ({
      formations: sortFormations(
        state.formations.map((f) => (f.id === formationId ? updated : f)),
      ),
    }))
    await get().loadWellInventories()
  },
  async updateZoneLithology(zoneId, lithologyFractions, lithologySource) {
    const wellId = get().well?.well_id
    if (!wellId) throw new Error('No well is currently loaded')

    const response = await fetch(`/api/wells/${wellId}/zones/${zoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lithology_fractions: lithologyFractions, lithology_source: lithologySource }),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to update zone lithology (${response.status})`))
    }
    const updated = (await response.json()) as FormationZone
    set((state) => ({
      zones: state.zones.map((z) => (z.zone_id === zoneId ? updated : z)),
    }))
    await get().loadWellInventories()
  },
  async loadSeaLevelCurves() {
    const response = await fetch('/api/sea-level-curves')
    if (!response.ok) throw new Error(`Failed to load sea level curves (${response.status})`)
    return (await response.json()) as SeaLevelCurve[]
  },
  async setWellActiveSeaLevelCurve(wellId, curveId) {
    const response = await fetch(`/api/wells/${wellId}/active-sea-level-curve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curve_id: curveId }),
    })
    if (!response.ok) throw new Error(await readError(response, `Failed to set sea level curve (${response.status})`))
    await get().loadWellInventories()
  },
}))
