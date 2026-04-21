import { create } from 'zustand'

import { sendRecalculation } from '@/api/subsidenceSocket'
import type { SubsidenceResult } from '@/types/subsidence'
import { useWellDataStore } from './wellDataStore'

export interface ComputedStore {
  subsidenceCurves: SubsidenceResult[]
  isComputing: boolean
  computeError: string | null
  lastComputeTime: number
  triggerRecalculation: () => void
  setResults: (results: SubsidenceResult[]) => void
  clearResults: () => void
}

export const useComputedStore = create<ComputedStore>((set) => ({
  subsidenceCurves: [],
  isComputing: false,
  computeError: null,
  lastComputeTime: 0,

  triggerRecalculation() {
    const wellId = useWellDataStore.getState().well?.well_id
    if (!wellId) return
    set({ isComputing: true, computeError: null })
    sendRecalculation(wellId)
  },

  setResults(results) {
    set({
      subsidenceCurves: results,
      isComputing: false,
      computeError: null,
      lastComputeTime: Date.now(),
    })
  },

  clearResults() {
    set({ subsidenceCurves: [], isComputing: false, computeError: null })
  },
}))
