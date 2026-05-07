import type { TopSetSummary, WellInventory } from '@/types'

interface TopSetSettingsProps {
  topSet: TopSetSummary
  activeWellId: string | null
  wellInventories: WellInventory[]
  onActivateTopSet: (topSetId: number, wellId: string) => void
}

export function TopSetSettings({ topSet, activeWellId, wellInventories, onActivateTopSet }: TopSetSettingsProps) {
  const activeWell = activeWellId ? wellInventories.find((item) => item.well_id === activeWellId) ?? null : null
  const isActive = activeWell?.active_top_set_id === topSet.id

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">{topSet.name}</div>
      </div>
      <div className="tree-leaf">
        <span>Status</span>
        <span>{isActive ? 'active' : 'inactive'}</span>
      </div>
      <div className="tree-leaf">
        <span>Markers</span>
        <span>{topSet.horizon_count}</span>
      </div>
      {activeWell ? (
        <div className="tree-leaf">
          <span>Current well</span>
          <span>{activeWell.well_name}</span>
        </div>
      ) : (
        <p className="sidebar-panel__empty">Select a well to activate this TopSet.</p>
      )}
      {activeWell && !isActive ? (
        <button
          type="button"
          className="dm-action dm-action--primary"
          onClick={() => onActivateTopSet(topSet.id, activeWell.well_id)}
        >
          Activate for current well
        </button>
      ) : null}
    </div>
  )
}
