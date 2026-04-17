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
}

function toFloat32Array(values: number[]): Float32Array {
  return new Float32Array(values)
}

const emptyState = {
  well: null,
  curves: [],
  formations: [],
  colorOverrides: {},
  isLoading: false,
  error: null,
}

export const useWellDataStore = create<WellDataStore>((set) => ({
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
      const response = await fetch(`/api/wells/${wellId}`)
      if (!response.ok) {
        throw new Error(`Failed to load well '${wellId}' (${response.status})`)
      }

      const payload = (await response.json()) as WellResponse
      const { curves, formations, ...well } = payload

      set({
        well,
        curves: curves.map((curve) => ({
          mnemonic: curve.mnemonic,
          unit: curve.unit,
          depths: toFloat32Array(curve.depths),
          values: toFloat32Array(curve.values),
          null_value: curve.null_value,
        })),
        formations,
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
}))
