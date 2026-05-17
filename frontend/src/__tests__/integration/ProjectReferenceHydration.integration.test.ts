import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProjectStore } from '@/stores/projectStore'
import { useWellDataStore } from '@/stores/wellDataStore'

const okJson = (payload: unknown) => ({
  ok: true,
  json: async () => payload,
})

describe('Project reference hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
    useProjectStore.setState({
      isOpen: false,
      projectName: null,
      projectPath: null,
      isDirty: false,
      backendDirty: false,
      pendingVisualConfigDirty: false,
      canUndo: false,
      canRedo: false,
      visualConfig: {},
      visualConfigSaveToken: 0,
      recentProjects: [],
    })
    useWellDataStore.getState().reset()
  })

  it('loads strat charts immediately after opening a project', async () => {
    const stratCharts = [
      {
        id: 1,
        name: 'ICS 2023',
        is_active: true,
        is_builtin: true,
        unit_count: 194,
        imported_at: '2026-05-17T00:00:00',
        source_path: 'builtin',
      },
    ]

    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/projects/open') {
        return Promise.resolve(okJson({
          project_name: 'Hydration Test',
          project_path: 'D:\\projects\\hydration.subsidence',
          is_dirty: false,
          can_undo: false,
          can_redo: false,
        }))
      }
      if (url === '/api/strat-charts') return Promise.resolve(okJson(stratCharts))
      if (url === '/api/top-sets') return Promise.resolve(okJson([]))
      if (url === '/api/sea-level/curves') return Promise.resolve(okJson([]))
      if (url === '/api/compaction/models') return Promise.resolve(okJson([]))
      if (url === '/api/compaction/presets') return Promise.resolve(okJson([]))
      if (url === '/api/compaction/mnemonic-sets') return Promise.resolve(okJson([]))
      if (url === '/api/compaction/unit-dimensions') return Promise.resolve(okJson([]))
      if (url === '/api/compaction/lithology-dictionary') return Promise.resolve(okJson([]))
      if (url === '/api/compaction/lithology-sets') return Promise.resolve(okJson([]))
      if (url === '/api/lithology-pattern-palettes') return Promise.resolve(okJson([]))
      if (url === '/api/projects/recent') return Promise.resolve(okJson([]))
      return Promise.resolve(okJson([]))
    })

    await useProjectStore.getState().openProject('D:\\projects\\hydration.subsidence')

    expect(useWellDataStore.getState().stratCharts).toEqual(stratCharts)
    expect(global.fetch).toHaveBeenCalledWith('/api/strat-charts')
  })

  it('keeps strat charts when the opened project has no wells', async () => {
    const stratCharts = [
      {
        id: 1,
        name: 'ICS 2023',
        is_active: true,
        is_builtin: true,
        unit_count: 194,
        imported_at: '2026-05-17T00:00:00',
        source_path: 'builtin',
      },
    ]
    useWellDataStore.setState({
      stratCharts,
      well: { well_id: 'stale-well', well_name: 'Stale Well', td_md: 100, color_hex: '#2563eb' } as any,
      curves: [{ mnemonic: 'GR', unit: 'gAPI', depths: new Float32Array([0]), values: new Float32Array([1]), null_value: -999.25 } as any],
      formations: [{ id: 'top-a', name: 'Top A', depth_md: 10 } as any],
    })

    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/wells/inventory') return Promise.resolve(okJson([]))
      if (url === '/api/sea-level-curves') return Promise.resolve(okJson([]))
      if (url === '/api/top-sets') return Promise.resolve(okJson([]))
      return Promise.resolve(okJson([]))
    })

    await useWellDataStore.getState().refreshWell()

    expect(useWellDataStore.getState().well).toBeNull()
    expect(useWellDataStore.getState().curves).toEqual([])
    expect(useWellDataStore.getState().formations).toEqual([])
    expect(useWellDataStore.getState().stratCharts).toEqual(stratCharts)
  })
})
