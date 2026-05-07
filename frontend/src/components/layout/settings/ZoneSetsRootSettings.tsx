import { useMemo } from 'react'
import { useWellDataStore } from '@/stores'

export function ZoneSetsRootSettings() {
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const topSets = useWellDataStore((s) => s.topSets)

  const { linkedWellCount } = useMemo(() => {
    const linkedWellIds = new Set<string>()
    for (const item of wellInventories) {
      if (item.active_top_set_id !== null) {
        linkedWellIds.add(item.well_id)
      }
    }
    return { linkedWellCount: linkedWellIds.size }
  }, [wellInventories])

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">STRATIGRAPHY</div>
      </div>
      <div className="tree-leaf">
        <span>TopSets</span>
        <span>{topSets.length}</span>
      </div>
      <div className="tree-leaf">
        <span>Linked wells</span>
        <span>{linkedWellCount}</span>
      </div>
      {topSets.length === 0 && (
        <p className="sidebar-panel__empty">No TopSets loaded. Import tops to create a TopSet.</p>
      )}
    </div>
  )
}
