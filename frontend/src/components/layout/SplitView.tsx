import { useCallback, useRef } from 'react'

interface SplitViewProps {
  left: React.ReactNode
  right: React.ReactNode
  subsidenceWidth: number
  onWidthChange: (w: number) => void
}

export function SplitView({ left, right, subsidenceWidth, onWidthChange }: SplitViewProps) {
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = subsidenceWidth
  }, [subsidenceWidth])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    // Drag left → divider moves left → subsidence panel gets wider
    const deltaX = e.clientX - startXRef.current
    onWidthChange(startWidthRef.current - deltaX)
  }, [onWidthChange])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    isDraggingRef.current = false
  }, [])

  return (
    <div className="split-view">
      <div className="split-view__pane split-view__pane--left">
        {left}
      </div>
      <div
        className="split-view__divider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="split-view__pane split-view__pane--right" style={{ width: subsidenceWidth }}>
        {right}
      </div>
    </div>
  )
}
