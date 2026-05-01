import type { FormationTop } from '@/types'
import { FormationTopsList } from '../FormationTopsList'

interface TopsSettingsProps {
  formations: FormationTop[]
  visibleFormationIds: string[]
}

export function TopsSettings({ formations, visibleFormationIds }: TopsSettingsProps) {
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
      <FormationTopsList />
    </div>
  )
}
