import { useMemo } from 'react'

import { useViewStore, useWellDataStore } from '@/stores'
import { mdToTvd } from '@/utils/depthTransform'

interface DepthCursorProps {
  yPosition: number
  depth?: number | null
}

export function DepthCursor({ yPosition, depth }: DepthCursorProps) {
  const unit = useViewStore((s) => s.depthTrackConfig.unit)
  const depthType = useViewStore((s) => s.depthType)
  const depthBasis = useWellDataStore((s) => s.depthBasis)
  const tvdTable = useWellDataStore((s) => s.tvdTable)
  const kbElev = useWellDataStore((s) => s.well?.kb_elev ?? 0)

  // In label-only mode (scroll still in MD) apply the same transform as DepthTrack
  const displayDepth = useMemo(() => {
    if (depth == null) return null
    if (depthBasis === depthType) return depth  // full coordinate mode: already in target space
    if (depthType === 'TVD' && tvdTable) return mdToTvd(depth, tvdTable)
    if (depthType === 'TVDSS') return tvdTable ? mdToTvd(depth, tvdTable) - kbElev : depth - kbElev
    return depth
  }, [depth, depthBasis, depthType, tvdTable, kbElev])

  let label: string | null = null
  if (displayDepth != null) {
    const value = unit === 'km' ? displayDepth / 1000 : unit === 'ft' ? displayDepth / 0.3048 : displayDepth
    const decimals = unit === 'km' ? 3 : 1
    label = `${value.toFixed(decimals)}`
  }

  const LABEL_W = 44
  const LABEL_H = 14

  return (
    <>
      <line
        x1={0}
        y1={yPosition}
        x2="100%"
        y2={yPosition}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1}
        style={{ pointerEvents: 'none' }}
      />
      {label && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={2}
            y={yPosition - LABEL_H / 2}
            width={LABEL_W}
            height={LABEL_H}
            fill="rgba(15,23,42,0.75)"
            rx={2}
          />
          <text
            x={2 + LABEL_W / 2}
            y={yPosition}
            dominantBaseline="middle"
            textAnchor="middle"
            fill="#f1f5f9"
            fontSize={9}
            fontWeight={600}
            style={{ userSelect: 'none' }}
          >
            {label}
          </text>
        </g>
      )}
    </>
  )
}
