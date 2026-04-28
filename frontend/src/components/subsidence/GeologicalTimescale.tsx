import { GEOLOGIC_ERAS, GEOLOGIC_PERIODS } from '@/utils/geologicalTimescale'
import type { GeologicUnit } from '@/utils/geologicalTimescale'

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

function TimescaleRow({
  units,
  minMa,
  maxMa,
  rowHeight,
  minWidthPctForLabel,
}: {
  units: GeologicUnit[]
  minMa: number
  maxMa: number
  rowHeight: number
  minWidthPctForLabel: number
}) {
  const span = maxMa - minMa || 1
  const blocks = units.flatMap((unit) => {
    const overlapStart = Math.max(unit.end_ma, minMa)
    const overlapEnd = Math.min(unit.start_ma, maxMa)
    if (overlapStart >= overlapEnd) return []
    const leftPct = ((maxMa - overlapEnd) / span) * 100
    const widthPct = ((overlapEnd - overlapStart) / span) * 100
    return [{ unit, leftPct, widthPct }]
  })

  return (
    <div style={{ position: 'relative', height: rowHeight, overflow: 'hidden', flexShrink: 0 }}>
      {blocks.map(({ unit, leftPct, widthPct }) => (
        <div
          key={unit.name}
          style={{
            position: 'absolute',
            left: `${leftPct}%`,
            top: 0,
            width: `${widthPct}%`,
            height: '100%',
            background: unit.color,
            borderRight: '1px solid #000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={`${unit.name} (${unit.start_ma}–${unit.end_ma} Ma)`}
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
            {widthPct > minWidthPctForLabel ? unit.abbreviation : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

export function GeologicalTimescale({
  timeRange,
  height = 52,
  paddingLeft = 0,
  paddingRight = 0,
}: GeologicalTimescaleProps) {
  const { min_ma, max_ma } = timeRange
  const eraRowH = Math.round(height * 0.38)
  const periodRowH = height - eraRowH

  return (
    <div
      className="geological-timescale"
      style={{ height, display: 'flex', flexDirection: 'column', flexShrink: 0 }}
    >
      {([
        { units: GEOLOGIC_ERAS, rowHeight: eraRowH, minPct: 3 },
        { units: GEOLOGIC_PERIODS, rowHeight: periodRowH, minPct: 4 },
      ] as const).map(({ units, rowHeight, minPct }, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'stretch', height: rowHeight, flexShrink: 0 }}>
          {paddingLeft > 0 && <div style={{ width: paddingLeft, flexShrink: 0 }} />}
          <div style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            marginRight: paddingRight,
            borderLeft: '1px solid #000',
            borderRight: '1px solid #000',
            borderTop: i === 0 ? '1px solid #000' : undefined,
            borderBottom: '1px solid #000',
          }}>
            <TimescaleRow
              units={units}
              minMa={min_ma}
              maxMa={max_ma}
              rowHeight={rowHeight}
              minWidthPctForLabel={minPct}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
