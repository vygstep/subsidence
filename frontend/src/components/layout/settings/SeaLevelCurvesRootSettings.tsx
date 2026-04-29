import { useWellDataStore } from '@/stores'

export function SeaLevelCurvesRootSettings() {
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const builtinCount = seaLevelCurves.filter((c) => c.is_builtin).length
  const userCount = seaLevelCurves.length - builtinCount

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Sea level curves</div>
        <div className="template-panel__value">{seaLevelCurves.length} curves</div>
      </div>
      <div className="sf-row">
        <span>Built-in</span>
        <span>{builtinCount}</span>
      </div>
      <div className="sf-row">
        <span>User-defined</span>
        <span>{userCount}</span>
      </div>
      {seaLevelCurves.length === 0 && (
        <p className="sidebar-panel__empty">No sea level curves available.</p>
      )}
    </div>
  )
}
