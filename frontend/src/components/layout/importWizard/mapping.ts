export interface FieldDefinition {
  id: string
  label: string
  required: boolean
  aliases: string[]
}

export type ColumnMapping = Record<string, string | null>

interface PreviewLike {
  columns: string[]
  rows: string[][]
}

interface PreservedColumnLabelOptions {
  numericOnly?: boolean
}

export const TOPS_FIELDS: FieldDefinition[] = [
  {
    id: 'top_name',
    label: 'Formation name',
    required: true,
    aliases: ['top_name', 'name', 'formation', 'top', 'horizon', 'pick', 'stratigraphic_unit', 'unit', 'marker'],
  },
  {
    id: 'depth_md',
    label: 'Depth (MD)',
    required: true,
    aliases: ['depth_md', 'depth', 'md', 'dept', 'depth_m', 'md_m', 'measured_depth'],
  },
  {
    id: 'well_name',
    label: 'Well name',
    required: false,
    aliases: ['well_name', 'well', 'wellname', 'well_id', 'uwi'],
  },
  {
    id: 'boundary_type',
    label: 'Boundary type',
    required: false,
    aliases: ['boundary_type', 'kind', 'type'],
  },
  {
    id: 'age_ma',
    label: 'Age (Ma)',
    required: false,
    aliases: ['age_ma', 'strat_age_ma', 'age'],
  },
  {
    id: 'hiatus_duration_ma',
    label: 'Hiatus duration (Ma)',
    required: false,
    aliases: ['hiatus_duration_ma', 'hiatus_ma', 'hiatus'],
  },
  {
    id: 'eroded_thickness_m',
    label: 'Eroded thickness (m)',
    required: false,
    aliases: ['eroded_thickness_m', 'eroded_m', 'eroded'],
  },
]

export const DEVIATION_FIELDS: FieldDefinition[] = [
  { id: 'well_name', label: 'Well name', required: false, aliases: ['well_name', 'well', 'wellname', 'well_id', 'uwi'] },
  { id: 'md', label: 'Depth (MD)', required: false, aliases: ['md', 'measured_depth', 'depth_md', 'dept', 'depth'] },
  { id: 'tvd', label: 'Depth (TVD)', required: false, aliases: ['tvd', 'true_vertical_depth', 'tvdkb'] },
  { id: 'tvdss', label: 'Depth (TVDSS)', required: false, aliases: ['tvdss', 'tvd_ss', 'depth_tvdss'] },
  { id: 'incl_deg', label: 'Inclination (°)', required: false, aliases: ['incl_deg', 'incl', 'inclination', 'dip', 'inc', 'angle'] },
  { id: 'azim_deg', label: 'Azimuth (°)', required: false, aliases: ['azim_deg', 'azim', 'azimuth', 'az', 'azi', 'bearing'] },
  { id: 'x', label: 'X offset', required: false, aliases: ['x', 'x_offset', 'easting', 'east', 'ns'] },
  { id: 'y', label: 'Y offset', required: false, aliases: ['y', 'y_offset', 'northing', 'north', 'ew'] },
  { id: 'dx', label: 'ΔX', required: false, aliases: ['dx', 'delta_x', 'delta_easting', 'deast'] },
  { id: 'dy', label: 'ΔY', required: false, aliases: ['dy', 'delta_y', 'delta_northing', 'dnorth'] },
]

export const LOGS_CSV_FIELDS: FieldDefinition[] = [
  {
    id: 'well_name',
    label: 'Well name',
    required: false,
    aliases: ['well_name', 'well', 'wellname', 'well_id', 'uwi'],
  },
  {
    id: 'depth',
    label: 'Depth',
    required: true,
    aliases: ['dept', 'depth', 'md', 'tvd', 'tvdss', 'depth_md', 'measured_depth'],
  },
]

export const WELLS_FIELDS: FieldDefinition[] = [
  { id: 'well_name', label: 'Well name', required: true, aliases: ['well_name', 'well', 'wellname', 'name'] },
  { id: 'uwi', label: 'UWI', required: false, aliases: ['uwi', 'api', 'well_id'] },
  { id: 'kb', label: 'KB', required: false, aliases: ['kb', 'kb_elev', 'kb_elevation'] },
  { id: 'td', label: 'TD', required: false, aliases: ['td', 'td_md', 'total_depth'] },
  { id: 'x', label: 'X', required: false, aliases: ['x', 'lon', 'longitude', 'easting'] },
  { id: 'y', label: 'Y', required: false, aliases: ['y', 'lat', 'latitude', 'northing'] },
  { id: 'crs', label: 'CRS', required: false, aliases: ['crs', 'coordinate_reference_system'] },
]

export const STRAT_CHART_FIELDS: FieldDefinition[] = [
  { id: 'unit_id', label: 'Unit ID', required: true, aliases: ['unit_id', 'id'] },
  { id: 'parent_unit_id', label: 'Parent unit ID', required: false, aliases: ['parent_unit_id', 'parent_id'] },
  { id: 'unit_name', label: 'Unit name', required: true, aliases: ['unit_name', 'name', 'strat_unit', 'unit'] },
  { id: 'rank_name', label: 'Rank name', required: false, aliases: ['rank_name', 'rank'] },
  { id: 'start_age_ma', label: 'Start age (Ma)', required: true, aliases: ['start_age_ma', 'start_age', 'age_base_ma', 'base_age_ma'] },
  { id: 'end_age_ma', label: 'End age (Ma)', required: true, aliases: ['end_age_ma', 'end_age', 'age_top_ma', 'top_age_ma'] },
  { id: 'unit_code', label: 'Unit code', required: false, aliases: ['unit_code', 'strat_index', 'unit_abbrev', 'code'] },
  { id: 'color', label: 'Color', required: false, aliases: ['html_rgb_hash', 'rgb', 'cmyk', 'color', 'color_hex', 'hex'] },
]

export const SEA_LEVEL_CURVE_FIELDS: FieldDefinition[] = [
  { id: 'age_ma', label: 'Age (Ma)', required: true, aliases: ['age_ma', 'age', 'age_ma_bp', 'time_ma'] },
  { id: 'sea_level_m', label: 'Sea level (m)', required: true, aliases: ['sea_level_m', 'sea_level', 'level_m', 'sl_m', 'eustatic_m'] },
]

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s[\]()\-_,./\\]+/g, '').replace(/unit[s]?$/, '')
}

export function autoMap(columns: string[], fields: FieldDefinition[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedColumns = new Set<string>()

  for (const field of fields) {
    mapping[field.id] = null
    for (const col of columns) {
      if (usedColumns.has(col)) continue
      const normalized = normalizeKey(col)
      if (field.aliases.some((alias) => normalizeKey(alias) === normalized)) {
        mapping[field.id] = col
        usedColumns.add(col)
        break
      }
    }
  }
  return mapping
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0
}

function isNumericPreviewColumn(preview: PreviewLike, colIdx: number): boolean {
  const values = preview.rows
    .map((row) => row[colIdx])
    .filter((value) => !isBlank(value))

  return values.length > 0 && values.every((value) => Number.isFinite(Number(value)))
}

export function preservedUnmappedColumnLabels(
  preview: PreviewLike | null,
  mapping: ColumnMapping,
  options: PreservedColumnLabelOptions = {},
): Record<string, string> {
  if (!preview) return {}

  const mappedColumns = new Set(
    Object.values(mapping).filter((value): value is string => value != null && value.length > 0),
  )
  const labels: Record<string, string> = {}

  preview.columns.forEach((column, colIdx) => {
    if (mappedColumns.has(column)) return
    if (options.numericOnly && !isNumericPreviewColumn(preview, colIdx)) return
    labels[column] = column
  })

  return labels
}

export function validateTopsMapping(mapping: ColumnMapping): string[] {
  return TOPS_FIELDS.filter((f) => f.required && !mapping[f.id]).map(
    (f) => `Required field "${f.label}" is not mapped.`,
  )
}

export function validateDeviationMapping(mapping: ColumnMapping): string[] {
  const errors: string[] = []
  const hasDepth = !!(mapping.md || mapping.tvd || mapping.tvdss)
  if (!hasDepth) errors.push('At least one depth column (MD, TVD, or TVDSS) must be mapped.')
  const hasMode = (mapping.incl_deg && mapping.azim_deg)
    || (mapping.x && mapping.y)
    || (mapping.dx && mapping.dy)
  if (!hasMode) errors.push('At least one pair must be mapped: Inclination/Azimuth, X/Y, or ΔX/ΔY.')
  return errors
}

export function validateLogsCsvMapping(mapping: ColumnMapping): string[] {
  return LOGS_CSV_FIELDS.filter((f) => f.required && !mapping[f.id]).map(
    (f) => `Required field "${f.label}" is not mapped.`,
  )
}

export function validateWellsMapping(mapping: ColumnMapping): string[] {
  return WELLS_FIELDS.filter((f) => f.required && !mapping[f.id]).map(
    (f) => `Required field "${f.label}" is not mapped.`,
  )
}

export function validateStratChartMapping(mapping: ColumnMapping): string[] {
  return STRAT_CHART_FIELDS.filter((f) => f.required && !mapping[f.id]).map(
    (f) => `Required field "${f.label}" is not mapped.`,
  )
}

export function validateSeaLevelCurveMapping(mapping: ColumnMapping): string[] {
  return SEA_LEVEL_CURVE_FIELDS.filter((f) => f.required && !mapping[f.id]).map(
    (f) => `Required field "${f.label}" is not mapped.`,
  )
}

export function isMappingValid(errors: string[]): boolean {
  return errors.length === 0
}
