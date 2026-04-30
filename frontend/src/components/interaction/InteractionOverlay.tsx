import { useId } from 'react'

import { useViewStore } from '@/stores'
import type { CurveData, FormationTop } from '@/types'

import { CurveTooltip } from './CurveTooltip'
import { DepthCursor } from './DepthCursor'
import { FormationTopLine } from './FormationTopLine'

interface InteractionOverlayProps {
  width: number
  height: number
  formations: FormationTop[]
  curves: CurveData[]
  depthToPixel: (depth: number) => number
  cursorDepth: number | null
  mouseClient: { x: number; y: number } | null
  tooltipVisible: boolean
  topsEditable: boolean
}

export function InteractionOverlay({
  width,
  height,
  formations,
  curves,
  depthToPixel,
  cursorDepth,
  mouseClient,
  tooltipVisible,
  topsEditable,
}: InteractionOverlayProps) {
  const activePickId = useViewStore((state) => state.activePickId)
  const setActivePickId = useViewStore((state) => state.setActivePickId)
  const clipPathId = `${useId().replace(/:/g, '')}-track-bounds`

  // Collect not-picked formations for indicator strip at top
  const notPickedFormations = formations.filter((f) => f.depth_md === null)

  return (
    <>
      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
          zIndex: 10,
          overflow: 'visible',
        }}
      >
        <defs>
          <clipPath id={clipPathId}>
            <rect x={0} y={0} width={width} height={height} />
          </clipPath>
        </defs>
        {formations.map((formation) => {
          if (formation.depth_md === null) return null
          const y = depthToPixel(formation.depth_md)
          if (y < -30 || y > height + 30) return null
          return (
            <FormationTopLine
              key={formation.id}
              formation={formation}
              yPosition={y}
              editable={topsEditable}
              isActivePick={activePickId === formation.id}
              onSetActivePick={setActivePickId}
              lineClipPathId={clipPathId}
            />
          )
        })}
        {/* Ghost line at cursor when a pick (including not-picked) is active */}
        {topsEditable && activePickId !== null && cursorDepth !== null && (
          <line
            x1={0}
            y1={depthToPixel(cursorDepth)}
            x2="100%"
            y2={depthToPixel(cursorDepth)}
            stroke={
              formations.find((f) => f.id === activePickId)?.active_strat_color ??
              formations.find((f) => f.id === activePickId)?.color ??
              '#9ca3af'
            }
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            clipPath={`url(#${clipPathId})`}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {cursorDepth !== null && <DepthCursor yPosition={depthToPixel(cursorDepth)} depth={cursorDepth} />}
        {/* Not-picked formation tap targets near the top */}
        {topsEditable && notPickedFormations.map((formation, i) => {
          const color = formation.active_strat_color ?? formation.color
          const isActive = activePickId === formation.id
          const rowH = 18
          const rowY = i * (rowH + 2) + 2
          return (
            <g
              key={formation.id}
              style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
              onClick={() => setActivePickId(isActive ? null : formation.id)}
            >
              <rect x={2} y={rowY} width={120} height={rowH} fill={color} opacity={isActive ? 1 : 0.6} rx={2} />
              <text
                x={6}
                y={rowY + rowH / 2}
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={10}
                fontWeight={isActive ? 700 : 500}
                style={{ userSelect: 'none' }}
              >
                {formation.name} (not picked)
              </text>
            </g>
          )
        })}
      </svg>
      {mouseClient !== null && cursorDepth !== null && (
        <CurveTooltip
          x={mouseClient.x}
          y={mouseClient.y}
          depth={cursorDepth}
          curves={curves}
          visible={tooltipVisible}
        />
      )}
    </>
  )
}
