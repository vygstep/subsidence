export const CURVE_TYPES = ['continuous', 'discrete'] as const
export type CurveType = typeof CURVE_TYPES[number]
