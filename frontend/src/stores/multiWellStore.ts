import { create } from 'zustand'

import type { SubsidenceResult } from '@/types/subsidence'

export interface WellSubsidenceResults {
  wellId: string
  wellName: string
  algorithm: string
  curves: SubsidenceResult[]
}

interface WellResultResponse {
  well_id: string
  well_name: string
  algorithm: string
  curves: SubsidenceResult[]
}

export interface MultiWellStore {
  wellResults: WellSubsidenceResults[]
  isFetching: boolean
  fetchResults: () => Promise<void>
}

export const useMultiWellStore = create<MultiWellStore>((set) => ({
  wellResults: [],
  isFetching: false,

  async fetchResults() {
    set({ isFetching: true })
    try {
      const response = await fetch('/api/subsidence/stored-results')
      if (!response.ok) return
      const data = (await response.json()) as WellResultResponse[]
      set({
        wellResults: data.map((d) => ({
          wellId: d.well_id,
          wellName: d.well_name,
          algorithm: d.algorithm,
          curves: d.curves,
        })),
      })
    } finally {
      set({ isFetching: false })
    }
  },
}))
