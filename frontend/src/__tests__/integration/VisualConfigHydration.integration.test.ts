import { beforeEach, describe, expect, it } from 'vitest'

import { useProjectStore } from '@/stores/projectStore'
import { useViewStore } from '@/stores/viewStore'
import { useWellDataStore } from '@/stores/wellDataStore'

describe('Project visual config hydration', () => {
  beforeEach(() => {
    ;(global.fetch as any).mockClear()
    useViewStore.getState().resetVisualConfig()
    useWellDataStore.setState({ colorOverrides: {} })
    useProjectStore.setState({ visualConfig: {} })
  })

  it('applies project visual config to view and curve stores', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: 'project',
        scope_id: 'project',
        config: {
          depthPerPixel: 1.5,
          trackWidths: { depth: 120, formations: 180 },
          curveColors: { GR: '#ff0000' },
          subsidenceWidth: 360,
          subsidenceSingleAgeMin: 10,
          subsidenceSingleAgeMax: 120,
          subsidenceMultiAgeMin: 5,
          subsidenceMultiAgeMax: 160,
          subsidenceReconstructStratUnitId: 41,
          subsidenceTruncateBelowStratUnitId: 42,
          depthTrackConfig: { majorInterval: 250 },
          formationsTrackConfig: { nameSource: 'linked-strat-unit' },
        },
      }),
    })

    await useProjectStore.getState().loadVisualConfig()

    expect(useProjectStore.getState().visualConfig.depthPerPixel).toBe(1.5)
    expect(useViewStore.getState().depthPerPixel).toBe(1.5)
    expect(useViewStore.getState().trackWidths.depth).toBe(120)
    expect(useViewStore.getState().trackWidths.formations).toBe(180)
    expect(useViewStore.getState().subsidenceWidth).toBe(360)
    expect(useViewStore.getState().subsidenceSingleAgeMin).toBe(10)
    expect(useViewStore.getState().subsidenceSingleAgeMax).toBe(120)
    expect(useViewStore.getState().subsidenceMultiAgeMin).toBe(5)
    expect(useViewStore.getState().subsidenceMultiAgeMax).toBe(160)
    expect(useViewStore.getState().subsidenceReconstructStratUnitId).toBe(41)
    expect(useViewStore.getState().subsidenceTruncateBelowStratUnitId).toBe(42)
    expect(useViewStore.getState().depthTrackConfig.majorInterval).toBe(250)
    expect(useViewStore.getState().formationsTrackConfig.nameSource).toBe('linked-strat-unit')
    expect(useWellDataStore.getState().colorOverrides.GR).toBe('#ff0000')
  })
})
