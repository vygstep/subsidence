export interface FieldDefinition {
  id: string
  label: string
  required: boolean
  aliases: string[]
}

export type ColumnMapping = Record<string, string | null>

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
]

export const DEVIATION_FIELDS: FieldDefinition[] = [
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
    id: 'depth',
    label: 'Depth column',
    required: true,
    aliases: ['dept', 'depth', 'md', 'tvd', 'tvdss', 'depth_md', 'measured_depth'],
  },
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

export function isMappingValid(errors: string[]): boolean {
  return errors.length === 0
}
