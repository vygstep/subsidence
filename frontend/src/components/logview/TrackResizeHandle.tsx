import { useCallback } from 'react'

import { useViewStore } from '@/stores'

export const TRACK_RESIZE_HANDLE_WIDTH = 2
export const DEPTH_TRACK_ID = 'depth'
export const FORMATION_TRACK_ID = 'formations'

interface TrackResizeHandleProps {
  trackId: string
  initialWidth: number
  edge?: 'left' | 'right'
}

export function TrackResizeHandle({ trackId, initialWidth, edge = 'right' }: TrackResizeHandleProps) {
  const setTrackWidth = useViewStore((state) => state.setTrackWidth)

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const startX = event.clientX
    const originWidth = initialWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const nextWidth = edge === 'left' ? originWidth - deltaX : originWidth + deltaX
      setTrackWidth(trackId, nextWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [edge, initialWidth, setTrackWidth, trackId])

  return (
    <div
      className="track-resize-handle"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${trackId} track`}
      title="Drag to resize"
    />
  )
}
