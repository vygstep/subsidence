import { GEOLOGIC_PERIODS } from '@/utils/geologicalTimescale'

interface TimeRange {
  min_ma: number
  max_ma: number
}

interface GeologicalTimescaleProps {
  timeRange: TimeRange
  height?: number
  paddingLeft?: number
  paddingRight?: number
}

export function GeologicalTimescale({
  timeRange,
  height = 40,
  paddingLeft = 0,
  paddingRight = 0,
}: GeologicalTimescaleProps) {
  const { min_ma, max_ma } = timeRange
  const span = max_ma - min_ma || 1

  const blocks = GEOLOGIC_PERIODS.flatMap((period) => {
    const overlapStart = Math.max(period.end_ma, min_ma)
    const overlapEnd = Math.min(period.start_ma, max_ma)
    if (overlapStart >= overlapEnd) return []

    // Percentage of the plot area: oldest at left, youngest at right
    const leftPct = ((max_ma - overlapEnd) / span) * 100
    const widthPct = ((overlapEnd - overlapStart) / span) * 100

    return [{ period, leftPct, widthPct }]
  })

  return (
    <div
      className="geological-timescale"
      style={{ height, display: 'flex', alignItems: 'stretch', flexShrink: 0 }}
    >
      {paddingLeft > 0 && (
        <div style={{ width: paddingLeft, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', marginRight: paddingRight }}>
        {blocks.map(({ period, leftPct, widthPct }) => (
          <div
            key={period.name}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: 0,
              width: `${widthPct}%`,
              height: '100%',
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
                display: 'block',
                textAlign: 'center',
              }}
            >
              {widthPct > 4 ? period.abbreviation : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
