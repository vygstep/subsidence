import { useViewStore } from '@/stores'

interface FormationsTrackSettingsProps {
  visibleFormationIds: string[]
}

export function FormationsTrackSettings({ visibleFormationIds }: FormationsTrackSettingsProps) {
  const formationsTrackConfig = useViewStore((state) => state.formationsTrackConfig)
  const updateFormationsTrackConfig = useViewStore((state) => state.updateFormationsTrackConfig)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Track</div>
        <div className="template-panel__value">FORMATIONS</div>
      </div>
      <div className="tree-leaf"><span>Visible tops</span><span>{visibleFormationIds.length}</span></div>
      <div className="sf-row">
        <span>Background color</span>
        <input
          type="color"
          className="sf-swatch"
          value={formationsTrackConfig.backgroundColor}
          onChange={(event) => updateFormationsTrackConfig({ backgroundColor: event.target.value })}
        />
      </div>
      <div className="sf-row">
        <span>Name source</span>
        <select
          value={formationsTrackConfig.nameSource}
          onChange={(event) => updateFormationsTrackConfig({
            nameSource: event.target.value as 'formation-name' | 'linked-strat-unit',
          })}
        >
          <option value="formation-name">Top name</option>
          <option value="linked-strat-unit">Linked strat unit</option>
        </select>
      </div>
    </div>
  )
}
