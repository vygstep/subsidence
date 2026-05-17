import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeVisibilityHandlers } from '@/components/layout/dataManagerVisibility'
import { buildTrackOrder, type WellViewState } from '@/stores/workspaceStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import { createMockCurveData, createMockTrackConfig, createMockWell } from '../fixtures'

describe('dataManagerVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWellDataStore.setState({
      well: createMockWell({ well_id: 'well-a' }),
      curves: [createMockCurveData({ mnemonic: 'GR', unit: 'API' })],
    })
  })

  it('keeps curve style but reassigns track placement when toggled back on', async () => {
    const savedCurve = {
      mnemonic: 'GR',
      unit: 'API',
      color: '#ff0000',
      lineWidth: 3,
      lineStyle: 'dashed' as const,
      scaleMin: 10,
      scaleMax: 110,
      scaleReversed: true,
    }
    let state: WellViewState = {
      tracks: [
        createMockTrackConfig({
          id: 'track-1',
          title: 'Track 1',
          curves: [savedCurve],
        }),
        createMockTrackConfig({
          id: 'track-2',
          title: 'Track 2',
          curves: [],
        }),
      ],
      trackOrder: buildTrackOrder(['track-1', 'track-2']),
      visibleFormationIds: [],
      hiddenTopSetZoneIds: [],
      hiddenCurveMnemonics: [],
      hiddenTopLabelIds: [],
      topLabelPositions: {},
      deviationVisible: false,
      hiddenTrackIds: [],
      curveSettingsByMnemonic: {},
    }
    const updateWellViewState = vi.fn((_wellId: string, updater: (s: WellViewState) => WellViewState) => {
      state = updater(state)
    })
    const loadWell = vi.fn().mockResolvedValue(undefined)

    await makeVisibilityHandlers({
      well: useWellDataStore.getState().well,
      selectedTrackId: 'track-1',
      updateWellViewState,
      loadWell,
    }).handleToggleCurve('well-a', 'GR', false)

    expect(state.hiddenCurveMnemonics).toContain('GR')
    expect(state.tracks.flatMap((track) => track.curves)).toHaveLength(0)
    expect(state.curveSettingsByMnemonic.GR).toMatchObject({
      color: '#ff0000',
      lineWidth: 3,
      lineStyle: 'dashed',
      scaleMin: 10,
      scaleMax: 110,
      scaleReversed: true,
    })

    await makeVisibilityHandlers({
      well: useWellDataStore.getState().well,
      selectedTrackId: 'track-2',
      updateWellViewState,
      loadWell,
    }).handleToggleCurve('well-a', 'GR', true)

    expect(state.hiddenCurveMnemonics).not.toContain('GR')
    expect(state.tracks.find((track) => track.id === 'track-1')?.curves).toEqual([])
    expect(state.tracks.find((track) => track.id === 'track-2')?.curves).toEqual([
      expect.objectContaining({
        mnemonic: 'GR',
        color: '#ff0000',
        lineWidth: 3,
        lineStyle: 'dashed',
        scaleMin: 10,
        scaleMax: 110,
        scaleReversed: true,
      }),
    ])
  })
})
