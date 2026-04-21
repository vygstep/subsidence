import { useState } from 'react'

import { buildTrackOrder, useWellDataStore, useViewStore, useWorkspaceStore } from '@/stores'
import type { TrackConfig } from '@/types'

import { DEPTH_TRACK_ID, FORMATION_TRACK_ID, TRACK_RESIZE_HANDLE_WIDTH } from './TrackResizeHandle'
import { TrackHeader } from './TrackHeader'

const DEFAULT_DEPTH_TRACK_WIDTH = 60
const DEFAULT_FORMATION_COLUMN_WIDTH = 80

interface TrackHeaderRowProps {
  tracks: TrackConfig[]
  trackOrder: string[]
}

export function TrackHeaderRow({ tracks, trackOrder }: TrackHeaderRowProps) {
  const trackWidths = useViewStore((state) => state.trackWidths)
  const selectedTrackId = useViewStore((state) => state.selectedTrackId)
  const selectTrack = useViewStore((state) => state.selectTrack)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const activeWellId = useWellDataStore((state) => state.well?.well_id ?? null)
  const depthReference = useWellDataStore((state) => state.well?.depth_reference ?? 'MD')
  const depthWidth = trackWidths[DEPTH_TRACK_ID] ?? DEFAULT_DEPTH_TRACK_WIDTH
  const formationWidth = trackWidths[FORMATION_TRACK_ID] ?? DEFAULT_FORMATION_COLUMN_WIDTH
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null)
  const [dropTargetTrackId, setDropTargetTrackId] = useState<string | null>(null)
  const tracksById = new Map(tracks.map((track) => [track.id, track]))

  const handleDrop = (targetTrackId: string) => {
    if (!activeWellId || !draggedTrackId || draggedTrackId === targetTrackId) {
      setDraggedTrackId(null)
      setDropTargetTrackId(null)
      return
    }

    updateWellViewState(activeWellId, (state) => {
      const currentOrder = buildTrackOrder(state.tracks.map((track) => track.id), state.trackOrder)
      const fromIndex = currentOrder.findIndex((trackId) => trackId === draggedTrackId)
      const toIndex = currentOrder.findIndex((trackId) => trackId === targetTrackId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return state
      }
      const nextTrackOrder = [...currentOrder]
      const [movedTrackId] = nextTrackOrder.splice(fromIndex, 1)
      nextTrackOrder.splice(toIndex, 0, movedTrackId)
      return {
        ...state,
        trackOrder: nextTrackOrder,
      }
    })

    selectTrack(draggedTrackId)
    setDraggedTrackId(null)
    setDropTargetTrackId(null)
  }

  return (
    <div className="track-header-row">
      {trackOrder.map((trackId) => {
        const sharedDragProps = {
          onDragStart: (event: React.DragEvent<HTMLButtonElement>) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', trackId)
            setDraggedTrackId(trackId)
            setDropTargetTrackId(trackId)
          },
          onDragEnd: () => {
            setDraggedTrackId(null)
            setDropTargetTrackId(null)
          },
          onDragOver: (event: React.DragEvent<HTMLButtonElement>) => {
            if (!draggedTrackId || draggedTrackId === trackId) {
              return
            }
            event.preventDefault()
            setDropTargetTrackId(trackId)
          },
          onDrop: (event: React.DragEvent<HTMLButtonElement>) => {
            event.preventDefault()
            handleDrop(trackId)
          },
        }

        if (trackId === DEPTH_TRACK_ID) {
          return (
            <div key={trackId} className="track-header-row__track-group">
              <button
                type="button"
                draggable
                className={`track-header-row__depth-header ${selectedTrackId === DEPTH_TRACK_ID ? 'track-header-row__special-header--selected' : ''} ${dropTargetTrackId === trackId && draggedTrackId !== trackId ? 'track-header-row__special-header--drag-over' : ''}`}
                style={{ width: depthWidth }}
                onClick={() => selectTrack(DEPTH_TRACK_ID)}
                {...sharedDragProps}
              >
                {depthReference}
              </button>
              <div className="track-header-row__resize-spacer" style={{ width: TRACK_RESIZE_HANDLE_WIDTH }} aria-hidden="true" />
            </div>
          )
        }

        if (trackId === FORMATION_TRACK_ID) {
          return (
            <div key={trackId} className="track-header-row__track-group">
              <button
                type="button"
                draggable
                className={`track-header-row__formation-header ${selectedTrackId === FORMATION_TRACK_ID ? 'track-header-row__special-header--selected' : ''} ${dropTargetTrackId === trackId && draggedTrackId !== trackId ? 'track-header-row__special-header--drag-over' : ''}`}
                style={{ width: formationWidth }}
                onClick={() => selectTrack(FORMATION_TRACK_ID)}
                {...sharedDragProps}
              >
                Formations
              </button>
              <div className="track-header-row__resize-spacer" style={{ width: TRACK_RESIZE_HANDLE_WIDTH }} aria-hidden="true" />
            </div>
          )
        }

        const track = tracksById.get(trackId)
        if (!track) {
          return null
        }

        return (
          <div key={track.id} className="track-header-row__track-group">
            <TrackHeader
              config={track}
              width={trackWidths[track.id] ?? track.width}
              isSelected={selectedTrackId === track.id}
              isDragOver={dropTargetTrackId === track.id && draggedTrackId !== track.id}
              onSelect={() => selectTrack(track.id)}
              {...sharedDragProps}
            />
            <div
              className="track-header-row__resize-spacer"
              style={{ width: TRACK_RESIZE_HANDLE_WIDTH }}
              aria-hidden="true"
            />
          </div>
        )
      })}
    </div>
  )
}
