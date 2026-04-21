import { GEOLOGIC_PERIODS } from '@/utils/geologicalTimescale'

interface TimeRange {
  min_ma: number
  max_ma: number
}

interface GeologicalTimescaleProps {
  timeRange: TimeRange
  width: number
  height?: number
}

export function GeologicalTimescale({ timeRange, width, height = 40 }: GeologicalTimescaleProps) {
  const { min_ma, max_ma } = timeRange
  const span = max_ma - min_ma

  const blocks = GEOLOGIC_PERIODS.flatMap((period) => {
    const overlapStart = Math.max(period.end_ma, min_ma)
    const overlapEnd = Math.min(period.start_ma, max_ma)
    if (overlapStart >= overlapEnd) return []

    // X: oldest (max_ma) at left, present (min_ma) at right
    const left = ((max_ma - overlapEnd) / span) * width
    const blockWidth = ((overlapEnd - overlapStart) / span) * width

    return [{ period, left, blockWidth }]
  })

  return (
    <div
      className="geological-timescale"
      style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0 }}
    >
      {blocks.map(({ period, left, blockWidth }) => (
        <div
          key={period.name}
          className="geological-timescale__block"
          style={{
            position: 'absolute',
            left,
            top: 0,
            width: blockWidth,
            height,
            background: period.color,
            borderRight: '1px solid rgba(0,0,0,0.25)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={`${period.name} (${period.start_ma}–${period.end_ma} Ma)`}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#111',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'clip',
              maxWidth: blockWidth - 4,
              display: 'block',
              textAlign: 'center',
            }}
          >
            {blockWidth >= 28 ? period.abbreviation : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
