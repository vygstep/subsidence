import { useViewStore } from '@/stores'

export function DepthTrackSettings() {
  const depthTrackConfig = useViewStore((state) => state.depthTrackConfig)
  const updateDepthTrackConfig = useViewStore((state) => state.updateDepthTrackConfig)
  const depthType = useViewStore((state) => state.depthType)
  const setDepthType = useViewStore((state) => state.setDepthType)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Track</div>
        <div className="template-panel__value">DEPTH</div>
      </div>
      <label className="project-dialog__field">
        <span>Depth reference</span>
        <select
          value={depthType}
          onChange={(event) => setDepthType(event.target.value as 'MD' | 'TVD')}
        >
          <option value="MD">MD</option>
          <option value="TVD">TVD</option>
        </select>
      </label>
      <label className="project-dialog__field">
        <span>Background color</span>
        <input
          type="color"
          value={depthTrackConfig.backgroundColor}
          onChange={(event) => updateDepthTrackConfig({ backgroundColor: event.target.value })}
        />
      </label>
      <div className="project-dialog__grid">
        <label className="project-dialog__field">
          <span>Units</span>
          <select
            value={depthTrackConfig.unit}
            onChange={(event) => updateDepthTrackConfig({ unit: event.target.value as 'm' | 'km' | 'ft' })}
          >
            <option value="m">m</option>
            <option value="km">km</option>
            <option value="ft">ft</option>
          </select>
        </label>
        <label className="project-dialog__field">
          <span>Major ticks</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={depthTrackConfig.majorInterval}
            onChange={(event) => updateDepthTrackConfig({ majorInterval: Number(event.target.value) })}
          />
        </label>
        <label className="project-dialog__field">
          <span>Minor ticks</span>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={depthTrackConfig.minorInterval}
            onChange={(event) => updateDepthTrackConfig({ minorInterval: Number(event.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}
