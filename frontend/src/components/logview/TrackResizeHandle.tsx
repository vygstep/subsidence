import { useCallback } from 'react'

import { useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import { DEPTH_TRACK_ID, FORMATION_TRACK_ID } from '@/stores/workspaceStore'

export const TRACK_RESIZE_HANDLE_WIDTH = 2

interface TrackResizeHandleProps {
  trackId: string
  initialWidth: number
  edge?: 'left' | 'right'
}

export function TrackResizeHandle({ trackId, initialWidth, edge = 'right' }: TrackResizeHandleProps) {
  const setTrackWidth = useViewStore((state) => state.setTrackWidth)
  const activeWellId = useWellDataStore((state) => state.well?.well_id)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const startX = event.clientX
    const originWidth = initialWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const nextWidth = edge === 'left' ? originWidth - deltaX : originWidth + deltaX
      setTrackWidth(trackId, nextWidth)
      if (activeWellId && trackId !== DEPTH_TRACK_ID && trackId !== FORMATION_TRACK_ID) {
        updateWellViewState(activeWellId, (state) => ({
          ...state,
          tracks: state.tracks.map((track) => (
            track.id === trackId
              ? { ...track, width: Math.max(80, Math.round(nextWidth)) }
              : track
          )),
        }))
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [activeWellId, edge, initialWidth, setTrackWidth, trackId, updateWellViewState])

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
