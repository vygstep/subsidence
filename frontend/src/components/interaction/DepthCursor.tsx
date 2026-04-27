import { useViewStore } from '@/stores'

interface DepthCursorProps {
  yPosition: number
  depth?: number | null
}

export function DepthCursor({ yPosition, depth }: DepthCursorProps) {
  const unit = useViewStore((s) => s.depthTrackConfig.unit)

  let label: string | null = null
  if (depth != null) {
    const value = unit === 'km' ? depth / 1000 : unit === 'ft' ? depth / 0.3048 : depth
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
