import type { FormationTop } from '@/types'
import { useViewStore } from '@/stores'
import { FormationTopsList } from '../FormationTopsList'

interface TopsSettingsProps {
  formations: FormationTop[]
  visibleFormationIds: string[]
}

export function TopsSettings({ formations, visibleFormationIds }: TopsSettingsProps) {
  const formationsTrackConfig = useViewStore((state) => state.formationsTrackConfig)
  const updateFormationsTrackConfig = useViewStore((state) => state.updateFormationsTrackConfig)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">TOPS</div>
      </div>
      <div className="tree-leaf"><span>Total picks</span><span>{formations.length}</span></div>
      <div className="tree-leaf"><span>Visible picks</span><span>{visibleFormationIds.length}</span></div>
      <div className="tree-leaf">
        <span>Linked picks</span>
        <span>{formations.filter((f) => Boolean(f.active_strat_unit_name)).length}</span>
      </div>
      <label className="sf-row">
        <span>Zone labels</span>
        <input
          type="checkbox"
          checked={formationsTrackConfig.showLabels}
          onChange={(e) => updateFormationsTrackConfig({ showLabels: e.target.checked })}
        />
      </label>
      <label className="sf-row">
        <span>Marker labels</span>
        <input
          type="checkbox"
          checked={formationsTrackConfig.showMarkerLabels}
          onChange={(e) => updateFormationsTrackConfig({ showMarkerLabels: e.target.checked })}
        />
      </label>
      <div className="sf-row">
        <span>Marker position</span>
        <select
          value={formationsTrackConfig.markerLabelPosition}
          onChange={(e) => updateFormationsTrackConfig({ markerLabelPosition: e.target.value as 'left' | 'center' | 'right' })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <FormationTopsList />
    </div>
  )
}
