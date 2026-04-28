import { useViewStore, useWellDataStore } from '@/stores'

export function DepthTrackSettings() {
  const depthTrackConfig = useViewStore((state) => state.depthTrackConfig)
  const updateDepthTrackConfig = useViewStore((state) => state.updateDepthTrackConfig)
  const depthType = useViewStore((state) => state.depthType)
  const setDepthType = useViewStore((state) => state.setDepthType)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Track</div>
        <div className="template-panel__value">DEPTH</div>
      </div>
      <div className="sf-row">
        <span>Reference type</span>
        <select
          value={depthType}
          onChange={(e) => setDepthType(e.target.value as 'MD' | 'TVD' | 'TVDSS')}
        >
          <option value="MD">MD</option>
          <option value="TVD">TVD</option>
          <option value="TVDSS" disabled={!tvdTable && kbElev === 0}>TVDSS</option>
        </select>
      </div>
      <div className="sf-row">
        <span>Background color</span>
        <input
          type="color"
          className="sf-swatch"
          value={depthTrackConfig.backgroundColor}
          onChange={(event) => updateDepthTrackConfig({ backgroundColor: event.target.value })}
        />
      </div>
      <div className="sf-row">
        <span>Units</span>
        <select
          value={depthTrackConfig.unit}
          onChange={(event) => updateDepthTrackConfig({ unit: event.target.value as 'm' | 'km' | 'ft' })}
        >
          <option value="m">m</option>
          <option value="km">km</option>
          <option value="ft">ft</option>
        </select>
      </div>
      <div className="sf-row">
        <span>Major ticks</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={depthTrackConfig.majorInterval}
          onChange={(event) => updateDepthTrackConfig({ majorInterval: Number(event.target.value) })}
        />
      </div>
      <div className="sf-row">
        <span>Minor ticks</span>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={depthTrackConfig.minorInterval}
          onChange={(event) => updateDepthTrackConfig({ minorInterval: Number(event.target.value) })}
        />
      </div>
    </div>
  )
}
