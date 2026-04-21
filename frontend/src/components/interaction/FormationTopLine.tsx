import type { FormationTop } from '@/types'

interface FormationTopLineProps {
  formation: FormationTop
  yPosition: number
}

const LABEL_HEIGHT = 18
const LABEL_PADDING = 5

export function FormationTopLine({ formation, yPosition }: FormationTopLineProps) {
  const color = formation.active_strat_color ?? formation.color

  return (
    <g style={{ pointerEvents: 'auto' }}>
      <line
        x1={0}
        y1={yPosition}
        x2="100%"
        y2={yPosition}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="6 3"
      />
      <rect
        x={2}
        y={yPosition - LABEL_HEIGHT}
        width={120}
        height={LABEL_HEIGHT}
        fill={color}
        opacity={0.85}
        rx={2}
      />
      <text
        x={LABEL_PADDING}
        y={yPosition - LABEL_HEIGHT / 2}
        dominantBaseline="middle"
        fill="#ffffff"
        fontSize={11}
        fontWeight={600}
        style={{ userSelect: 'none' }}
      >
        {formation.name}
      </text>
      {formation.is_locked && (
        <text
          x={126}
          y={yPosition - LABEL_HEIGHT / 2}
          dominantBaseline="middle"
          fill={color}
          fontSize={11}
          style={{ userSelect: 'none' }}
        >
          🔒
        </text>
      )}
    </g>
  )
}
