import { create } from 'zustand'

import type { CurveData, FormationTop, Well } from '@/types'

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
  strat_color?: string | null
  is_locked: boolean
  lithology?: FormationTop['lithology']
  strat_unit_id?: number | null
  strat_unit_name?: string | null
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
  strat_unit_id?: number | null
}

export interface WellDataStore {
  well: Well | null
  curves: CurveData[]
  formations: FormationTop[]
  colorOverrides: Record<string, string>
  isLoading: boolean
  error: string | null
  reset: () => void
  setColorOverrides: (overrides: Record<string, string>) => void
  loadWell: (wellId: string) => Promise<void>
  addFormation: (formation: FormationCreatePayload) => Promise<void>
  updateFormation: (formationId: string, patch: FormationPatchPayload) => Promise<void>
  updateFormationDepth: (formationId: string, depth: number) => Promise<void>
  removeFormation: (formationId: string) => Promise<void>
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
    strat_color: row.strat_color,
    is_locked: row.is_locked,
    lithology: row.lithology,
    strat_unit_id: row.strat_unit_id,
    strat_unit_name: row.strat_unit_name,
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
  curves: [],
  formations: [],
  colorOverrides: {},
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
    } catch (error) {
      set({
        ...emptyState,
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
  },
}))
