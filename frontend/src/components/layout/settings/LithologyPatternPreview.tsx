import type { LithologyPatternEntry } from '@/types'

export function svgPatternBackground(pattern: LithologyPatternEntry | null | undefined): string | undefined {
  if (!pattern?.svg_content) return undefined
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(pattern.svg_content)}")`
}

export function LithologyPatternPreview({ pattern }: { pattern: LithologyPatternEntry | null | undefined }) {
  return (
    <span
      className={`lithology-pattern-preview ${pattern ? '' : 'lithology-pattern-preview--solid'}`}
      style={{ backgroundImage: svgPatternBackground(pattern) }}
      title={pattern ? pattern.display_name : 'Solid fill'}
    />
  )
}
