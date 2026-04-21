export interface SurveyPoint {
  md: number
  inclination_deg: number
  azimuth_deg: number
}

export interface TVDTable {
  md: Float32Array
  tvd: Float32Array
}

export function minCurvatureToTVD(survey: SurveyPoint[]): TVDTable {
  if (survey.length === 0) {
    return { md: new Float32Array(0), tvd: new Float32Array(0) }
  }

  const md = new Float32Array(survey.length)
  const tvd = new Float32Array(survey.length)

  md[0] = survey[0].md
  tvd[0] = 0

  for (let i = 1; i < survey.length; i++) {
    const p1 = survey[i - 1]
    const p2 = survey[i]
    const dmd = p2.md - p1.md

    const i1 = (p1.inclination_deg * Math.PI) / 180
    const i2 = (p2.inclination_deg * Math.PI) / 180
    const a1 = (p1.azimuth_deg * Math.PI) / 180
    const a2 = (p2.azimuth_deg * Math.PI) / 180

    // Dogleg angle
    const cosAlpha =
      Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(a2 - a1))
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)))

    // Ratio factor
    const rf = alpha < 1e-10 ? 1.0 : (2 / alpha) * Math.tan(alpha / 2)

    const dtvd = (dmd / 2) * (Math.cos(i1) + Math.cos(i2)) * rf

    md[i] = p2.md
    tvd[i] = tvd[i - 1] + dtvd
  }

  return { md, tvd }
}

export function mdToTvd(mdValue: number, table: TVDTable): number {
  const { md, tvd } = table
  if (md.length === 0) return mdValue
  if (mdValue <= md[0]) return tvd[0]
  if (mdValue >= md[md.length - 1]) return tvd[tvd.length - 1]

  // Binary search
  let lo = 0
  let hi = md.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1
    if (md[mid] <= mdValue) lo = mid
    else hi = mid
  }

  const t = (mdValue - md[lo]) / (md[hi] - md[lo])
  return tvd[lo] + t * (tvd[hi] - tvd[lo])
}
