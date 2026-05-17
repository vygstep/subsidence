import type { StratUnitOption } from '@/types'
import { buildStratTimescaleRows, type TimescaleBlockUnit } from '@/utils/stratTimescale'

interface TimeRange {
  min_ma: number
  max_ma: number
}

interface GeologicalTimescaleProps {
  timeRange: TimeRange
  height?: number
  paddingLeft?: number
  paddingRight?: number
  stratUnits?: StratUnitOption[]
  upperRank?: string | null
  lowerRank?: string | null
}

function TimescaleRow({
  units,
  minMa,
  maxMa,
  rowHeight,
  minWidthPctForLabel,
}: {
  units: TimescaleBlockUnit[]
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
          key={unit.id}
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
          title={`${unit.name} (${unit.start_ma}-${unit.end_ma} Ma)`}
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
            {widthPct > minWidthPctForLabel ? unit.label : ''}
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
  stratUnits = [],
  upperRank = null,
  lowerRank = null,
}: GeologicalTimescaleProps) {
  const { min_ma, max_ma } = timeRange
  const upperRowH = Math.round(height / 2)
  const lowerRowH = height - upperRowH
  const rows = buildStratTimescaleRows({
    units: stratUnits,
    minMa: min_ma,
    maxMa: max_ma,
    upperRank,
    lowerRank,
  })

  return (
    <div
      className="geological-timescale"
      style={{ height, display: 'flex', flexDirection: 'column', flexShrink: 0 }}
    >
      {rows.map(({ units, rank, isFallback }, i) => {
        const rowHeight = i === 0 ? upperRowH : lowerRowH
        return (
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
                minWidthPctForLabel={i === 0 ? 3 : 4}
              />
              {units.length === 0 || isFallback ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: 2,
                    fontSize: 9,
                    color: '#64748b',
                    pointerEvents: 'none',
                  }}
                >
                  {units.length === 0 ? 'No StratChart units' : `Using ${rank}`}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
