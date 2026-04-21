import type { CurveData, FormationTop } from '@/types'

import { CurveTooltip } from './CurveTooltip'
import { DepthCursor } from './DepthCursor'
import { FormationTopLine } from './FormationTopLine'

interface InteractionOverlayProps {
  height: number
  formations: FormationTop[]
  curves: CurveData[]
  depthToPixel: (depth: number) => number
  cursorDepth: number | null
  mouseClient: { x: number; y: number } | null
}

export function InteractionOverlay({
  height,
  formations,
  curves,
  depthToPixel,
  cursorDepth,
  mouseClient,
}: InteractionOverlayProps) {
  return (
    <>
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
      {mouseClient !== null && cursorDepth !== null && (
        <CurveTooltip
          x={mouseClient.x}
          y={mouseClient.y}
          depth={cursorDepth}
          curves={curves}
          visible
        />
      )}
    </>
  )
}
