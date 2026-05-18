import { describe, expect, it } from 'vitest'

import { createDefaultWellView, syncWellViewCurveMetadata } from '@/stores/workspaceStore'
import type { CurveData } from '@/types'

function curveData(curve_type: 'continuous' | 'discrete'): CurveData {
  return {
    mnemonic: 'GR',
    unit: 'gAPI',
    depths: new Float32Array([0, 1]),
    values: new Float32Array([80, 81]),
    null_value: -999.25,
    curve_type,
    discrete_code_map: null,
    lithology_set_id: null,
  }
}

describe('workspace curve metadata sync', () => {
  it('updates persisted curve type from loaded curve metadata while preserving visual settings', () => {
    const view = createDefaultWellView()
    view.curveSettingsByMnemonic.GR = {
      mnemonic: 'GR',
      unit: 'API',
      color: '#00ff00',
      lineWidth: 3,
      lineStyle: 'dashed',
      scaleMin: 0,
      scaleMax: 150,
      scaleReversed: false,
      curve_type: 'discrete',
    }
    view.tracks[0].curves = [view.curveSettingsByMnemonic.GR]

    const synced = syncWellViewCurveMetadata(view, [curveData('continuous')])

    expect(synced.curveSettingsByMnemonic.GR).toMatchObject({
      color: '#00ff00',
      lineWidth: 3,
      lineStyle: 'dashed',
      unit: 'gAPI',
      curve_type: 'continuous',
    })
    expect(synced.tracks[0].curves[0].curve_type).toBe('continuous')
  })
})
