import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWellDataStore } from '@/stores/wellDataStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createMockWell, createMockFormations, createMockCurveData } from '../fixtures'

describe('WellSwitching - Selection Cleanup + Data Reload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
  })

  it('should load new well data when switching', async () => {
    const { result: wellResult } = renderHook(() => useWellDataStore())

    const wellA = createMockWell({ well_id: 'well-a', well_name: 'Well A' })
    const wellB = createMockWell({ well_id: 'well-b', well_name: 'Well B' })

    const formationsA = createMockFormations(2)
    const formationsB = createMockFormations(2)

    // Setup: load Well A
    act(() => {
      wellResult.current.well = wellA
      wellResult.current.formations = formationsA
    })

    expect(wellResult.current.well?.well_id).toBe('well-a')
    expect(wellResult.current.formations).toEqual(formationsA)

    // Mock API responses for Well B (loadWell: well data + formations + inventory)
    ;(global.fetch as any).mockImplementationOnce((url: string) => {
      if (url.includes('/api/wells/well-b')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...wellB,
              curves: [],
              formations: formationsB,
            }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })

    ;(global.fetch as any).mockImplementationOnce((url: string) => {
      if (url.includes('/formations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(formationsB),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })

    // loadWellInventories called after loadWell succeeds
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    // Act: switch to Well B
    act(() => {
      wellResult.current.loadWell('well-b')
    })

    // Assert: Well B data loaded and store reflects the new well
    await waitFor(() => {
      expect(wellResult.current.well?.well_id).toBe('well-b')
    })
    expect(wellResult.current.error).toBeNull()
  })

  it('should sort formations by depth after loading', async () => {
    const { result } = renderHook(() => useWellDataStore())

    const unsortedFormations = [
      createMockFormations(1)[0], // will be at 500
      createMockFormations(1)[0], // will be at 1000
      createMockFormations(1)[0], // will be at 1500
    ]
    unsortedFormations[0].depth_md = 1500
    unsortedFormations[0].id = 'formation-1'
    unsortedFormations[1].depth_md = 500
    unsortedFormations[1].id = 'formation-2'
    unsortedFormations[2].depth_md = 1000
    unsortedFormations[2].id = 'formation-3'

    const well = createMockWell()

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...well,
        curves: [],
        formations: unsortedFormations,
      }),
    })

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => unsortedFormations,
    })

    // loadWellInventories called after loadWell succeeds
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    act(() => {
      result.current.loadWell(well.well_id)
    })

    await waitFor(() => {
      expect(result.current.well?.well_id).toBe(well.well_id)
    })

    // Assert: formations are sorted
    const depths = result.current.formations.map((f) => f.depth_md)
    expect(depths).toEqual([500, 1000, 1500])
  })

  it('should convert curves to Float32Array', async () => {
    const { result } = renderHook(() => useWellDataStore())

    const well = createMockWell()
    const curveData = {
      mnemonic: 'GR',
      unit: 'API',
      depths: [0, 100, 200, 300], // plain numbers
      values: [20, 40, 50, 60],
      null_value: -999.25,
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...well,
        curves: [curveData],
        formations: [],
      }),
    })

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    // loadWellInventories called after loadWell succeeds
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    act(() => {
      result.current.loadWell(well.well_id)
    })

    await waitFor(() => {
      expect(result.current.curves.length).toBeGreaterThan(0)
    })

    // Assert: curves are Float32Array
    const curve = result.current.curves[0]
    expect(curve.depths).toBeInstanceOf(Float32Array)
    expect(curve.values).toBeInstanceOf(Float32Array)
  })

  it('should handle missing formations gracefully', async () => {
    const { result } = renderHook(() => useWellDataStore())

    const well = createMockWell()

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...well,
        curves: [createMockCurveData()],
        formations: [],
      }),
    })

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    // loadWellInventories called after loadWell succeeds
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    act(() => {
      result.current.loadWell(well.well_id)
    })

    await waitFor(() => {
      expect(result.current.well?.well_id).toBe(well.well_id)
    })

    expect(result.current.formations).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should maintain wellInventories after well switch', async () => {
    const { result } = renderHook(() => useWellDataStore())

    const well = createMockWell()
    const inventories = [
      { ...well, well_id: 'well-1', curves: [], formations: [] },
      { ...well, well_id: 'well-2', curves: [], formations: [] },
    ]

    ;(global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => inventories,
      }),
    )

    act(() => {
      result.current.loadWellInventories()
    })

    await waitFor(() => {
      expect(result.current.wellInventories).toHaveLength(2)
    })

    // Act: load one well
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...well,
        curves: [],
        formations: [],
      }),
    })

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => inventories,
    })

    act(() => {
      result.current.loadWell('well-1')
    })

    await waitFor(() => {
      expect(result.current.well?.well_id).toBe(well.well_id)
    })

    // Assert: wellInventories preserved
    expect(result.current.wellInventories).toHaveLength(2)
  })

  it('should handle network error during well load', async () => {
    const { result } = renderHook(() => useWellDataStore())

    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    act(() => {
      result.current.loadWell('well-1')
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.well).toBeNull()
    expect(result.current.curves).toEqual([])
  })
})
