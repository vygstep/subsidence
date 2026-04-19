import { create } from 'zustand'

import type { CurveData, FormationTop, StratChartInfo, Well, WellInventory } from '@/types'

interface CurveResponse {
  mnemonic: string
  unit: string
  depths: number[]
  values: number[]
  null_value: number
}

interface WellResponse extends Well {
  curves: CurveResponse[]
  formations: FormationTop[]
}

interface FormationResponse {
  id: string
  name: string
  depth_md: number
  age_ma?: number
  color: string
  kind: string
  is_locked: boolean
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
  color?: string
  kind?: string
  lithology?: FormationTop['lithology']
  age_ma?: number
  is_locked?: boolean
}

export interface WellDataStore {
  well: Well | null
  wellInventories: WellInventory[]
  curves: CurveData[]
  formations: FormationTop[]
  colorOverrides: Record<string, string>
  stratCharts: StratChartInfo[]
  isLoading: boolean
  error: string | null
  reset: () => void
  setColorOverrides: (overrides: Record<string, string>) => void
  loadWellInventories: () => Promise<void>
  loadWell: (wellId: string) => Promise<void>
  addFormation: (formation: FormationCreatePayload) => Promise<void>
  updateFormation: (formationId: string, patch: FormationPatchPayload) => Promise<void>
  updateFormationDepth: (formationId: string, depth: number) => Promise<void>
  removeFormation: (formationId: string) => Promise<void>
  loadStratCharts: () => Promise<void>
  activateChart: (chartId: number) => Promise<void>
  deleteChart: (chartId: number) => Promise<void>
  linkFormationToChart: (formationId: string, chartId: number, stratUnitId: number | null) => Promise<void>
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
  return [...formations].sort((left, right) => left.depth_md - right.depth_md)
}

function mapFormation(row: FormationResponse): FormationTop {
  return {
    id: row.id,
    name: row.name,
    depth_md: row.depth_md,
    age_ma: row.age_ma,
    color: row.color,
    kind: row.kind,
    is_locked: row.is_locked,
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

const emptyState = {
  well: null,
  wellInventories: [],
  curves: [],
  formations: [],
  colorOverrides: {},
  stratCharts: [],
  isLoading: false,
  error: null,
}

export const useWellDataStore = create<WellDataStore>((set, get) => ({
  ...emptyState,
  reset() {
    set(emptyState)
  },
  setColorOverrides(overrides) {
    set({ colorOverrides: overrides })
  },
  async loadWellInventories() {
    const response = await fetch('/api/wells/inventory')
    if (!response.ok) {
      throw new Error(await readError(response, `Failed to load well inventories (${response.status})`))
    }
    const payload = (await response.json()) as WellInventory[]
    set({ wellInventories: payload })
  },
  async loadWell(wellId: string) {
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
        })),
        formations: sortFormations(formationPayload.map(mapFormation)),
        isLoading: false,
        error: null,
      })
      await get().loadWellInventories()
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
  },
  async loadStratCharts() {
    const response = await fetch('/api/strat-charts')
    if (!response.ok) return
    const charts = (await response.json()) as StratChartInfo[]
    set({ stratCharts: charts })
  },
  async activateChart(chartId) {
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
  },
  async deleteChart(chartId) {
    const response = await fetch(`/api/strat-charts/${chartId}`, { method: 'DELETE' })
    if (!response.ok) return
    set((state) => ({ stratCharts: state.stratCharts.filter((c) => c.id !== chartId) }))
    // Refresh formations
    const wellId = get().well?.well_id
    if (wellId) {
      const formations = await fetchFormations(wellId)
      set({ formations: sortFormations(formations.map(mapFormation)) })
    }
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
}))
