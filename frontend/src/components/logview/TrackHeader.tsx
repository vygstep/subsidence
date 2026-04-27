import type { TrackConfig } from '@/types'

import { CurveScaleBar } from './CurveScaleBar'

interface TrackHeaderProps {
  config: TrackConfig
  width: number
  isSelected?: boolean
  isDragOver?: boolean
  onSelect?: () => void
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: React.DragEvent<HTMLButtonElement>) => void
}

export function TrackHeader({
  config,
  width,
  isSelected = false,
  isDragOver = false,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TrackHeaderProps) {
  return (
    <button
      type="button"
      draggable
      className={`track-header ${isSelected ? 'track-header--selected' : ''} ${isDragOver ? 'track-header--drag-over' : ''}`}
      style={{ width }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="track-header__title">{config.title}</div>
      {config.curves.map((curve) => (
        <CurveScaleBar key={curve.mnemonic} curve={curve} />
      ))}
    </button>
  )
}
