import { useComputedStore, useViewStore } from '@/stores'
import type { SubsidenceModelType } from '@/stores/viewStore'

const MODEL_LABELS: Record<SubsidenceModelType, string> = {
  total: 'Total burial / total subsidence',
  decompaction: 'Decompaction',
  airy: 'Airy backstripping',
  stepwise: 'Stepwise backstripping through time',
  thermal: 'Thermal subsidence fitting',
}

interface SubsidenceModelSettingsProps {
  modelType: SubsidenceModelType
}

export function SubsidenceModelSettings({ modelType }: SubsidenceModelSettingsProps) {
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)
  const setShowFormationFills = useComputedStore((s) => s.setShowFormationFills)
  const setShowBurialCurves = useComputedStore((s) => s.setShowBurialCurves)

  const isAvailable = modelType === 'total'

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Model</div>
        <div className="template-panel__value">{MODEL_LABELS[modelType]}</div>
      </div>

      {!isAvailable && (
        <p className="sidebar-panel__empty">This model is not yet implemented.</p>
      )}

      {isAvailable && (
        <>
          <div className="template-panel__section-header">Display</div>
          <label className="sf-row">
            <span>Burial curves</span>
            <input
              type="checkbox"
              checked={showBurialCurves}
              onChange={(e) => setShowBurialCurves(e.target.checked)}
            />
          </label>
          <label className="sf-row">
            <span>Formation fills</span>
            <input
              type="checkbox"
              checked={showFormationFills}
              onChange={(e) => setShowFormationFills(e.target.checked)}
            />
          </label>
        </>
      )}
    </div>
  )
}
