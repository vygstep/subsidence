import { create } from 'zustand'

import { sendRecalculation } from '@/api/subsidenceSocket'
import type { SubsidenceResult } from '@/types/subsidence'
import { useWellDataStore } from './wellDataStore'

const COMPUTE_TIMEOUT_MS = 30_000
let computeTimeout: number | null = null

function clearComputeTimeout(): void {
  if (computeTimeout !== null) {
    window.clearTimeout(computeTimeout)
    computeTimeout = null
  }
}

function scheduleComputeTimeout(): void {
  clearComputeTimeout()
  computeTimeout = window.setTimeout(() => {
    useComputedStore.setState({
      isComputing: false,
      computeError: 'Subsidence recalculation timed out',
    })
    computeTimeout = null
  }, COMPUTE_TIMEOUT_MS)
}

export interface ComputedStore {
  subsidenceCurves: SubsidenceResult[]
  isComputing: boolean
  computeError: string | null
  lastComputeTime: number
  triggerRecalculation: () => void
  setResults: (results: SubsidenceResult[]) => void
  setComputeError: (message: string) => void
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
    scheduleComputeTimeout()
    sendRecalculation(wellId)
  },

  setResults(results) {
    clearComputeTimeout()
    set({
      subsidenceCurves: results,
      isComputing: false,
      computeError: null,
      lastComputeTime: Date.now(),
    })
  },

  setComputeError(message) {
    clearComputeTimeout()
    set({
      isComputing: false,
      computeError: message,
    })
  },

  clearResults() {
    clearComputeTimeout()
    set({ subsidenceCurves: [], isComputing: false, computeError: null })
  },
}))
