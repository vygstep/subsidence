import { describe, expect, it } from 'vitest'

import { detectCsvLogCurveType } from '@/utils/curveTypeDetection'

describe('CSV log curve type detection', () => {
  it('keeps integer continuous log curves continuous by default', () => {
    const rows = [['100', '80'], ['101', '81'], ['102', '79']]

    expect(detectCsvLogCurveType('GR', 1, rows)).toBe('continuous')
  })

  it('detects explicit code and facies columns as discrete when values are integer codes', () => {
    const rows = [['100', '1', '2'], ['101', '1', '3'], ['102', '2', '3']]

    expect(detectCsvLogCurveType('LITH_CODE', 1, rows)).toBe('discrete')
    expect(detectCsvLogCurveType('FACIES', 2, rows)).toBe('discrete')
  })

  it('keeps named code columns continuous when values are not integer codes', () => {
    const rows = [['100', 'sand'], ['101', 'shale']]

    expect(detectCsvLogCurveType('LITH_CODE', 1, rows)).toBe('continuous')
  })
})
