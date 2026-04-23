import { create } from 'zustand'

import { sendRecalculation } from '@/api/subsidenceSocket'
import type { SubsidenceResult } from '@/types/subsidence'
import { logDiagnosticEvent } from '@/utils/diagnostics'
import { useMultiWellStore } from './multiWellStore'
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
    logDiagnosticEvent({
      level: 'error',
      operation: 'subsidence.recalculate',
      phase: 'failure',
      activeWellId: useWellDataStore.getState().well?.well_id,
      error: 'Subsidence recalculation timed out',
    })
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
  showFormationFills: boolean
  showBurialCurves: boolean
  waterDepthM: number
  triggerRecalculation: () => void
  setResults: (results: SubsidenceResult[]) => void
  setComputeError: (message: string) => void
  clearResults: () => void
  setShowFormationFills: (v: boolean) => void
  setShowBurialCurves: (v: boolean) => void
  setWaterDepthM: (v: number) => void
}

export const useComputedStore = create<ComputedStore>((set, get) => ({
  subsidenceCurves: [],
  isComputing: false,
  computeError: null,
  lastComputeTime: 0,
  showFormationFills: true,
  showBurialCurves: true,
  waterDepthM: 0,

  setShowFormationFills(v) { set({ showFormationFills: v }) },
  setShowBurialCurves(v) { set({ showBurialCurves: v }) },
  setWaterDepthM(v) {
    set({ waterDepthM: v })
    get().triggerRecalculation()
  },

  triggerRecalculation() {
    const wellId = useWellDataStore.getState().well?.well_id
    if (!wellId) return
    logDiagnosticEvent({
      level: 'info',
      operation: 'subsidence.recalculate',
      phase: 'start',
      activeWellId: wellId,
      details: { waterDepthM: get().waterDepthM },
    })
    set({ isComputing: true, computeError: null })
    scheduleComputeTimeout()
    sendRecalculation(wellId, get().waterDepthM)
  },

  setResults(results) {
    clearComputeTimeout()
    logDiagnosticEvent({
      level: 'info',
      operation: 'subsidence.recalculate',
      phase: 'success',
      activeWellId: useWellDataStore.getState().well?.well_id,
      details: { resultCount: results.length },
    })
    set({
      subsidenceCurves: results,
      isComputing: false,
      computeError: null,
      lastComputeTime: Date.now(),
    })
    useMultiWellStore.getState().fetchResults()
  },

  setComputeError(message) {
    clearComputeTimeout()
    logDiagnosticEvent({
      level: 'error',
      operation: 'subsidence.recalculate',
      phase: 'failure',
      activeWellId: useWellDataStore.getState().well?.well_id,
      error: message,
    })
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
