interface DepthCursorProps {
  yPosition: number
}

export function DepthCursor({ yPosition }: DepthCursorProps) {
  return (
    <line
      x1={0}
      y1={yPosition}
      x2="100%"
      y2={yPosition}
      stroke="rgba(0,0,0,0.4)"
      strokeWidth={1}
      style={{ pointerEvents: 'none' }}
    />
  )
}
