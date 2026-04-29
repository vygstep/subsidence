import { useWellDataStore } from '@/stores'

interface SeaLevelCurveSettingsProps {
  curveId: number
}

export function SeaLevelCurveSettings({ curveId }: SeaLevelCurveSettingsProps) {
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const curve = seaLevelCurves.find((c) => c.id === curveId)

  if (!curve) {
    return <p className="sidebar-panel__empty">Sea level curve not found.</p>
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Sea level curve</div>
        <div className="template-panel__value">{curve.name}</div>
      </div>
      <div className="sf-row">
        <span>Points</span>
        <span>{curve.point_count}</span>
      </div>
      <div className="sf-row">
        <span>Type</span>
        <span>{curve.is_builtin ? 'Built-in' : 'User-defined'}</span>
      </div>
      {curve.source && (
        <div className="tree-leaf" style={{ alignItems: 'flex-start', gap: 8 }}>
          <span style={{ flexShrink: 0 }}>Source</span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', wordBreak: 'break-word' }}>{curve.source}</span>
        </div>
      )}
    </div>
  )
}
