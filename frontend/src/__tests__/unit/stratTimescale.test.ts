import { describe, expect, it } from 'vitest'

import type { StratUnitOption } from '@/types'
import { buildStratTimescaleRows } from '@/utils/stratTimescale'

const units: StratUnitOption[] = [
  { id: 1, name: 'Paleozoic', rank: 'era', age_top_ma: 251.9, age_base_ma: 538.8, color_hex: '#aabbcc' },
  { id: 2, name: 'Devonian', unit_code: 'D', rank: 'period', age_top_ma: 358.9, age_base_ma: 419.2, color_hex: '#ddaa00' },
  { id: 3, name: 'Carboniferous', rank: 'period', age_top_ma: 298.9, age_base_ma: 358.9, color_hex: '#00aadd' },
  { id: 4, name: 'Frasnian', rank: 'age', age_top_ma: 372.2, age_base_ma: 382.7, color_hex: '#cc00aa' },
]

describe('buildStratTimescaleRows', () => {
  it('uses the first two available ranks in auto mode', () => {
    const rows = buildStratTimescaleRows({ units, minMa: 250, maxMa: 430 })

    expect(rows[0].rank).toBe('era')
    expect(rows[0].units.map((unit) => unit.name)).toEqual(['Paleozoic'])
    expect(rows[1].rank).toBe('period')
    expect(rows[1].units.map((unit) => unit.name)).toEqual(['Carboniferous', 'Devonian'])
  })

  it('honors selected ranks when they exist', () => {
    const rows = buildStratTimescaleRows({
      units,
      minMa: 250,
      maxMa: 430,
      upperRank: 'period',
      lowerRank: 'age',
    })

    expect(rows[0].rank).toBe('period')
    expect(rows[1].rank).toBe('age')
    expect(rows[1].isFallback).toBe(false)
    expect(rows[0].units.find((unit) => unit.name === 'Devonian')?.label).toBe('D')
  })

  it('supports explicit unit name labels', () => {
    const rows = buildStratTimescaleRows({
      units,
      minMa: 250,
      maxMa: 430,
      upperRank: 'period',
      lowerRank: 'age',
      labelMode: 'unit-name',
    })

    expect(rows[0].units.find((unit) => unit.name === 'Devonian')?.label).toBe('Devonian')
  })

  it('falls back to the nearest coarser available rank for missing sparse ranks', () => {
    const rows = buildStratTimescaleRows({
      units: units.filter((unit) => unit.rank !== 'age'),
      minMa: 250,
      maxMa: 430,
      upperRank: 'period',
      lowerRank: 'age',
    })

    expect(rows[0].rank).toBe('period')
    expect(rows[1].rank).toBeNull()
  })

  it('fills lower-rank gaps inside upper intervals with the nearest available child rank', () => {
    const sparseUnits: StratUnitOption[] = [
      { id: 10, name: 'Precambrian', rank: 'eon', age_top_ma: 538.8, age_base_ma: 4600, color_hex: '#999999' },
      { id: 11, name: 'Phanerozoic', rank: 'eon', age_top_ma: 0, age_base_ma: 538.8, color_hex: '#aaaaaa' },
      { id: 12, name: 'Neoproterozoic', rank: 'era', age_top_ma: 538.8, age_base_ma: 1000, color_hex: '#bbbbbb' },
      { id: 13, name: 'Cambrian', rank: 'period', age_top_ma: 485.4, age_base_ma: 538.8, color_hex: '#cccccc' },
    ]

    const rows = buildStratTimescaleRows({
      units: sparseUnits,
      minMa: 0,
      maxMa: 1000,
      upperRank: 'eon',
      lowerRank: 'period',
    })

    expect(rows[1].rank).toBe('period')
    expect(rows[1].isFallback).toBe(true)
    expect(rows[1].units.map((unit) => unit.name)).toEqual(['Cambrian', 'Neoproterozoic'])
  })
})
