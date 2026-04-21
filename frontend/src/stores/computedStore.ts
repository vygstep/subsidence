import { create } from 'zustand'

import type { SubsidenceResult } from '@/types/subsidence'
import { useWellDataStore } from './wellDataStore'

let _abortController: AbortController | null = null

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

    _abortController?.abort()
    _abortController = new AbortController()
    const signal = _abortController.signal

    set({ isComputing: true, computeError: null })

    void fetch(`/api/wells/${wellId}/subsidence`, {
      method: 'POST',
      signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          throw new Error(text)
        }
        return res.json() as Promise<SubsidenceResult[]>
      })
      .then((results) => {
        set({
          subsidenceCurves: results,
          isComputing: false,
          computeError: null,
          lastComputeTime: Date.now(),
        })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        set({
          isComputing: false,
          computeError: err instanceof Error ? err.message : String(err),
        })
      })
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
