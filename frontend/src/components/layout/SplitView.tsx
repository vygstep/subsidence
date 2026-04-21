import { useCallback, useRef } from 'react'

interface SplitViewProps {
  left: React.ReactNode
  right: React.ReactNode
  ratio: number
  onRatioChange: (r: number) => void
}

export function SplitView({ left, right, ratio, onRatioChange }: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const newRatio = (e.clientX - rect.left) / rect.width
    onRatioChange(newRatio)
  }, [onRatioChange])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    isDraggingRef.current = false
  }, [])

  return (
    <div ref={containerRef} className="split-view">
      <div className="split-view__pane" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        className="split-view__divider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="split-view__pane split-view__pane--right">
        {right}
      </div>
    </div>
  )
}
