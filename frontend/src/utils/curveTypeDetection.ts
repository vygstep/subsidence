import type { CurveType } from './curveTypes'

export function detectCsvLogCurveType(columnName: string, colIndex: number, rows: string[][]): CurveType {
  const normalizedName = columnName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const hasDiscreteName = /(^|_)(code|flag|facies|lith|lithology|class|category|zone_code)(_|$)/.test(normalizedName)
  if (!hasDiscreteName) return 'continuous'

  const values = rows.map((row) => row[colIndex]).filter((value) => value !== '' && value !== null && value !== undefined)
  if (values.length === 0) return 'continuous'
  return values.every((value) => /^-?\d+$/.test(value.trim())) ? 'discrete' : 'continuous'
}
