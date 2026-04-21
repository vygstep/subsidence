import { useCallback, useState } from 'react'

import { useFormationDrag } from '@/hooks'
import { useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { FormationTop } from '@/types'

interface FormationTopLineProps {
  formation: FormationTop
  yPosition: number
}

const LABEL_HEIGHT = 18
const LABEL_PADDING = 5

export function FormationTopLine({ formation, yPosition }: FormationTopLineProps) {
  const updateFormationDepth = useWellDataStore((state) => state.updateFormationDepth)
  const wellId = useWellDataStore((state) => state.well?.well_id)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const [localY, setLocalY] = useState<number | null>(null)

  const handleDragStart = useCallback(() => {
    if (!wellId) return
    setSelectedFormationId(formation.id)
    setSelectedObject({ type: 'top-pick', wellId, formationId: formation.id })
  }, [formation.id, setSelectedFormationId, setSelectedObject, wellId])

  const handleDepthChange = useCallback((depth: number) => {
    const { scrollDepth, depthPerPixel } = useViewStore.getState()
    setLocalY((depth - scrollDepth) / depthPerPixel)
  }, [])

  const handleDragEnd = useCallback(
    (finalDepth: number) => {
      setLocalY(null)
      void updateFormationDepth(formation.id, finalDepth)
    },
    [formation.id, updateFormationDepth],
  )

  const { isDragging, dragHandlers } = useFormationDrag({
    formation,
    onDragStart: handleDragStart,
    onDepthChange: handleDepthChange,
    onDragEnd: handleDragEnd,
  })

  const color = formation.active_strat_color ?? formation.color
  const displayY = localY !== null ? localY : yPosition
  const cursor = formation.is_locked ? 'not-allowed' : 'ns-resize'
  const strokeOpacity = isDragging ? 1.0 : 0.75

  return (
    <g style={{ pointerEvents: 'auto', cursor }} {...dragHandlers}>
      <line
        x1={0}
        y1={displayY}
        x2="100%"
        y2={displayY}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="6 3"
        strokeOpacity={strokeOpacity}
      />
      <rect
        x={2}
        y={displayY - LABEL_HEIGHT}
        width={120}
        height={LABEL_HEIGHT}
        fill={color}
        opacity={0.85}
        rx={2}
      />
      <text
        x={LABEL_PADDING}
        y={displayY - LABEL_HEIGHT / 2}
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
          y={displayY - LABEL_HEIGHT / 2}
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
