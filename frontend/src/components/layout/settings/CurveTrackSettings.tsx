import type { TrackConfig } from '@/types'

interface CurveTrackSettingsProps {
  track: TrackConfig
  onTrackSettingUpdate: (trackId: string, patch: Partial<TrackConfig>) => void
}

export function CurveTrackSettings({ track, onTrackSettingUpdate }: CurveTrackSettingsProps) {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Track</div>
        <div className="template-panel__value">{track.title || 'Untitled'}</div>
      </div>
      <div className="tree-leaf"><span>Curves</span><span>{track.curves.length}</span></div>
      <div className="sf-row">
        <span>Title</span>
        <input
          value={track.title}
          onChange={(e) => onTrackSettingUpdate(track.id, { title: e.target.value })}
        />
      </div>
      <div className="sf-row">
        <span>Width (px)</span>
        <input
          type="number"
          min="30"
          step="10"
          value={track.width}
          onChange={(e) => onTrackSettingUpdate(track.id, { width: Number(e.target.value) })}
        />
      </div>
      <div className="sf-row">
        <span>Scale type</span>
        <select
          value={track.scaleType}
          onChange={(e) => onTrackSettingUpdate(track.id, { scaleType: e.target.value as 'linear' | 'logarithmic' })}
        >
          <option value="linear">Linear</option>
          <option value="logarithmic">Logarithmic</option>
        </select>
      </div>
      <div className="sf-row">
        <span>Grid divisions</span>
        <input
          type="number"
          min="1"
          step="1"
          value={track.gridDivisions}
          onChange={(e) => onTrackSettingUpdate(track.id, { gridDivisions: Number(e.target.value) })}
        />
      </div>
      <label className="sf-row">
        <span>Show vertical grid</span>
        <input
          type="checkbox"
          checked={track.showGrid}
          onChange={(e) => onTrackSettingUpdate(track.id, { showGrid: e.target.checked })}
        />
      </label>
      <label className="sf-row">
        <span>Show horizontal grid</span>
        <input
          type="checkbox"
          checked={track.showHorizontalGrid ?? true}
          onChange={(e) => onTrackSettingUpdate(track.id, { showHorizontalGrid: e.target.checked })}
        />
      </label>
      <div className="sf-row">
        <span>Grid color</span>
        <input
          type="color"
          className="sf-swatch"
          value={track.gridColor ?? '#d5e1ec'}
          onChange={(e) => onTrackSettingUpdate(track.id, { gridColor: e.target.value })}
        />
      </div>
    </div>
  )
}
