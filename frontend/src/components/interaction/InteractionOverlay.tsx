import type { FormationTop } from '@/types'

import { DepthCursor } from './DepthCursor'
import { FormationTopLine } from './FormationTopLine'

interface InteractionOverlayProps {
  height: number
  formations: FormationTop[]
  depthToPixel: (depth: number) => number
  cursorDepth: number | null
}

export function InteractionOverlay({ height, formations, depthToPixel, cursorDepth }: InteractionOverlayProps) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      {formations.map((formation) => {
        const y = depthToPixel(formation.depth_md)
        if (y < -30 || y > height + 30) return null
        return <FormationTopLine key={formation.id} formation={formation} yPosition={y} />
      })}
      {cursorDepth !== null && <DepthCursor yPosition={depthToPixel(cursorDepth)} />}
    </svg>
  )
}
