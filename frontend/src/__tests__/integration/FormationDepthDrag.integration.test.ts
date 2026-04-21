import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWellDataStore } from '@/stores/wellDataStore'
import { createMockFormations, createMockWell, createMockCurveData } from '../fixtures'

describe('FormationDepthDrag - Debounce + Optimistic Update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should apply optimistic update immediately', async () => {
    const { result } = renderHook(() => useWellDataStore())

    // Setup: load a well with formations
    const mockWell = createMockWell()
    const mockFormations = createMockFormations(3)
    const mockCurves = [createMockCurveData()]

    act(() => {
      result.current.well = mockWell
      result.current.formations = mockFormations
      result.current.curves = mockCurves
    })

    const originalFormation = mockFormations[1]
    const newDepth = 1500

    // Act: update formation depth
    act(() => {
      result.current.updateFormationDepth(originalFormation.id, newDepth)
    })

    // Assert: optimistic update is immediate (no await needed)
    expect(result.current.formations.find((f) => f.id === originalFormation.id)?.depth_md).toBe(newDepth)
  })

  it('should maintain sorted order after optimistic update', async () => {
    const { result } = renderHook(() => useWellDataStore())

    const mockWell = createMockWell()
    const mockFormations = [
      createMockFormations(1)[0], // depth 500
      createMockFormations(1)[0], // depth 500 (will change this to 1200)
      createMockFormations(1)[0], // depth 500
    ]
    // Manually set depths for clarity
    mockFormations[0].depth_md = 500
    mockFormations[1].depth_md = 1000
    mockFormations[1].id = 'formation-middle'
    mockFormations[2].depth_md = 1500

    act(() => {
      result.current.well = mockWell
      result.current.formations = [...mockFormations]
    })

    // Act: move middle formation to 1200 (between current and next)
    act(() => {
      result.current.updateFormationDepth('formation-middle', 1200)
    })

    // Assert: formations should still be sorted by depth
    const depths = result.current.formations.map((f) => f.depth_md)
    expect(depths).toEqual([...depths].sort((a, b) => a - b))
  })

  it('should debounce PATCH request - only send one after multiple rapid updates', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWellDataStore())

    const mockWell = createMockWell()
    const mockFormations = createMockFormations(1)
    const mockCurves = [createMockCurveData()]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockFormations[0].id,
        name: mockFormations[0].name,
        depth_md: 1500,
        color: mockFormations[0].color,
        kind: mockFormations[0].kind,
        is_locked: mockFormations[0].is_locked,
        age_ma: mockFormations[0].age_ma,
        lithology: mockFormations[0].lithology,
        strat_links: [],
        active_strat_color: null,
        active_strat_unit_name: null,
      }),
    })

    // loadWellInventories called after successful PATCH
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    act(() => {
      result.current.well = mockWell
      result.current.formations = mockFormations
      result.current.curves = mockCurves
    })

    const formationId = mockFormations[0].id

    // Act: rapid updates (simulating fast dragging)
    act(() => {
      result.current.updateFormationDepth(formationId, 1000)
    })
    expect(result.current.formations[0].depth_md).toBe(1000)

    act(() => {
      vi.advanceTimersByTime(50)
      result.current.updateFormationDepth(formationId, 1100)
    })
    expect(result.current.formations[0].depth_md).toBe(1100)

    act(() => {
      vi.advanceTimersByTime(50)
      result.current.updateFormationDepth(formationId, 1200)
    })
    expect(result.current.formations[0].depth_md).toBe(1200)

    // Advance to debounce timeout and flush promises
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    // Assert: only ONE PATCH sent (not three), plus one inventory call
    const patchCalls = (global.fetch as any).mock.calls.filter(([url]: [string]) =>
      url.includes('/formations/'),
    )
    expect(patchCalls).toHaveLength(1)

    // Verify the PATCH was for the final value
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/formations/'),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"depth_md":1200'),
      }),
    )

    vi.useRealTimers()
  })

  it('should handle network error gracefully', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWellDataStore())

    const mockWell = createMockWell()
    const mockFormations = createMockFormations(1)

    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    // Mock loadWellInventories to prevent infinite loop
    result.current.loadWellInventories = vi.fn().mockResolvedValue(undefined)

    act(() => {
      result.current.well = mockWell
      result.current.formations = mockFormations
    })

    const formationId = mockFormations[0].id
    // Act: update and wait for debounce
    act(() => {
      result.current.updateFormationDepth(formationId, 1500)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    // Assert: optimistic update stays, but error is set
    expect(result.current.error).toBeTruthy()

    vi.useRealTimers()
  })

  it('should not have pending patches after successful update', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWellDataStore())

    const mockWell = createMockWell()
    const mockFormations = createMockFormations(1)

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockFormations[0].id,
        name: mockFormations[0].name,
        depth_md: 1500,
        color: mockFormations[0].color,
        kind: mockFormations[0].kind,
        is_locked: mockFormations[0].is_locked,
        age_ma: mockFormations[0].age_ma,
        lithology: mockFormations[0].lithology,
        strat_links: [],
        active_strat_color: null,
        active_strat_unit_name: null,
      }),
    })

    // loadWellInventories called after successful PATCH
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    act(() => {
      result.current.well = mockWell
      result.current.formations = mockFormations
    })

    act(() => {
      result.current.updateFormationDepth(mockFormations[0].id, 1500)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(global.fetch).toHaveBeenCalled()

    // After success, no pending patches should exist
    expect(result.current.error).toBeNull()

    vi.useRealTimers()
  })
})
