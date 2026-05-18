import { describe, expect, it } from 'vitest'

import {
  STRAT_CHART_FIELDS,
  autoMap,
  preservedUnmappedColumnLabels,
} from '@/components/layout/importWizard/mapping'

describe('import mapping definitions', () => {
  it('maps StratChart strat_index to unit_code', () => {
    const mapping = autoMap(
      ['id', 'parent_id', 'name', 'rank', 'age_base_ma', 'age_top_ma', 'strat_index', 'html_rgb_hash'],
      STRAT_CHART_FIELDS,
    )

    expect(mapping.unit_id).toBe('id')
    expect(mapping.parent_unit_id).toBe('parent_id')
    expect(mapping.unit_code).toBe('strat_index')
    expect(mapping.color).toBe('html_rgb_hash')
  })

  it('shows source labels for preserved unmapped columns', () => {
    const preview = {
      columns: ['well_name', 'td', 'operator', 'field'],
      rows: [['A-1', '1200', 'ACME', 'North']],
    }

    expect(preservedUnmappedColumnLabels(preview, { well_name: 'well_name', td: 'td' })).toEqual({
      operator: 'operator',
      field: 'field',
    })
  })

  it('shows only numeric preserved labels when requested', () => {
    const preview = {
      columns: ['md', 'tvd', 'quality_code', 'comment'],
      rows: [
        ['0', '0', '1', 'tie'],
        ['100', '99', '2', 'survey'],
      ],
    }

    expect(
      preservedUnmappedColumnLabels(preview, { md: 'md', tvd: 'tvd' }, { numericOnly: true }),
    ).toEqual({
      quality_code: 'quality_code',
    })
  })
})
