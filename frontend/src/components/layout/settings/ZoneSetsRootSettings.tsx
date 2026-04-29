import { useMemo } from 'react'
import { useWellDataStore } from '@/stores'

export function ZoneSetsRootSettings() {
  const wellInventories = useWellDataStore((s) => s.wellInventories)

  const { zoneSetCount, linkedWellCount } = useMemo(() => {
    const zoneSetIds = new Set<number>()
    const linkedWellIds = new Set<string>()
    for (const item of wellInventories) {
      if (item.active_top_set_id !== null) {
        zoneSetIds.add(item.active_top_set_id)
        linkedWellIds.add(item.well_id)
      }
    }
    return { zoneSetCount: zoneSetIds.size, linkedWellCount: linkedWellIds.size }
  }, [wellInventories])

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">ZONES</div>
      </div>
      <div className="tree-leaf">
        <span>ZoneSets</span>
        <span>{zoneSetCount}</span>
      </div>
      <div className="tree-leaf">
        <span>Linked wells</span>
        <span>{linkedWellCount}</span>
      </div>
      {zoneSetCount === 0 && (
        <p className="sidebar-panel__empty">No ZoneSets assigned. Import tops and assign a ZoneSet to a well.</p>
      )}
    </div>
  )
}
