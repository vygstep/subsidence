import { useMemo } from 'react'
import { useWellDataStore } from '@/stores'

export function ZoneSetsRootSettings() {
  const wellInventories = useWellDataStore((s) => s.wellInventories)

  const { topSetCount, linkedWellCount } = useMemo(() => {
    const topSetIds = new Set<number>()
    const linkedWellIds = new Set<string>()
    for (const item of wellInventories) {
      if (item.active_top_set_id !== null) {
        topSetIds.add(item.active_top_set_id)
        linkedWellIds.add(item.well_id)
      }
    }
    return { topSetCount: topSetIds.size, linkedWellCount: linkedWellIds.size }
  }, [wellInventories])

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">STRATIGRAPHY</div>
      </div>
      <div className="tree-leaf">
        <span>TopSets</span>
        <span>{topSetCount}</span>
      </div>
      <div className="tree-leaf">
        <span>Linked wells</span>
        <span>{linkedWellCount}</span>
      </div>
      {topSetCount === 0 && (
        <p className="sidebar-panel__empty">No TopSets assigned. Import tops and assign a TopSet to a well.</p>
      )}
    </div>
  )
}
