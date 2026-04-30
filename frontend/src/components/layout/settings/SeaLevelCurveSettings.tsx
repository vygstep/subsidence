import { defaultSeaLevelOverlayStyle, useViewStore, useWellDataStore, type SeaLevelOverlayLineStyle } from '@/stores'

interface SeaLevelCurveSettingsProps {
  curveId: number
}

export function SeaLevelCurveSettings({ curveId }: SeaLevelCurveSettingsProps) {
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const seaLevelOverlayStyles = useViewStore((s) => s.seaLevelOverlayStyles)
  const updateSeaLevelOverlayStyle = useViewStore((s) => s.updateSeaLevelOverlayStyle)
  const curve = seaLevelCurves.find((c) => c.id === curveId)
  const style = seaLevelOverlayStyles[curveId] ?? defaultSeaLevelOverlayStyle(curveId)

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
      <div className="template-panel__section-header">Display</div>
      <div className="sf-row">
        <span>Color</span>
        <input
          type="color"
          className="sf-swatch"
          value={style.colorHex}
          onChange={(event) => updateSeaLevelOverlayStyle(curveId, { colorHex: event.target.value })}
        />
      </div>
      <div className="sf-row">
        <span>Line style</span>
        <select
          value={style.lineStyle}
          onChange={(event) => updateSeaLevelOverlayStyle(curveId, { lineStyle: event.target.value as SeaLevelOverlayLineStyle })}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
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
