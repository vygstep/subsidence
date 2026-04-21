import type { CompactionModel } from '@/types'

interface CompactionModelsTabProps {
  models: CompactionModel[]
  selectedModelId: number | null
  onSelect: (modelId: number) => void
  onActivate: (modelId: number) => void
  onDelete: (modelId: number) => void
  onCreate: () => void
}

export function CompactionModelsTab({
  models,
  selectedModelId,
  onSelect,
  onActivate,
  onDelete,
  onCreate,
}: CompactionModelsTabProps) {
  return (
    <div className="sidebar-panel__body">
      <div className="strat-chart-list">
        {models.map((model) => (
          <div
            key={model.id}
            className={`strat-chart-item ${model.is_active ? 'strat-chart-item--active' : ''} ${selectedModelId === model.id ? 'strat-chart-item--selected' : ''}`}
            onClick={() => onSelect(model.id)}
          >
            <label className="strat-chart-item__radio-label">
              <input
                type="radio"
                name="active-compaction-model"
                checked={model.is_active}
                onChange={() => onActivate(model.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="strat-chart-item__name">{model.name}</span>
            </label>
            {model.is_builtin && (
              <span className="strat-chart-item__meta">built-in</span>
            )}
            <button
              type="button"
              className="strat-chart-item__delete"
              title={
                model.is_builtin ? 'Built-in model cannot be deleted'
                : model.is_active ? 'Activate another model first'
                : 'Delete this model'
              }
              disabled={model.is_builtin || model.is_active}
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`Delete compaction model "${model.name}"?`)) {
                  onDelete(model.id)
                }
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          style={{ width: '100%', fontSize: '0.8rem' }}
          onClick={onCreate}
        >
          + New model
        </button>
      </div>
    </div>
  )
}
