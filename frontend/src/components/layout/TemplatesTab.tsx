import { useState } from 'react'

import type {
  CompactionModel,
  CurveDictionaryEntry,
  LithologyDictionaryEntry,
} from '@/types'

interface TemplatesTabProps {
  curveDictionaryEntries: CurveDictionaryEntry[]
  lithologyDictionaryEntries: LithologyDictionaryEntry[]
  models: CompactionModel[]
  selectedModelId: number | null
  selectedCurveDictionaryEntryId: number | null
  selectedLithologyDictionaryEntryId: number | null
  onSelectModel: (modelId: number) => void
  onSelectCurveDictionaryEntry: (entryId: number) => void
  onSelectLithologyDictionaryEntry: (entryId: number) => void
  onActivateModel: (modelId: number) => void
  onDeleteModelById: (modelId: number, name: string, isBuiltin: boolean, isActive: boolean) => void
  onCreateModel: () => void
  onContextMenuModel: (event: React.MouseEvent, model: CompactionModel) => void
}

interface TemplateSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  actions?: React.ReactNode
  children: React.ReactNode
}

function TemplateSection({
  title,
  count,
  defaultOpen = false,
  actions,
  children,
}: TemplateSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="template-section">
      <button
        type="button"
        className="template-section__toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span className={`template-section__chevron ${isOpen ? 'template-section__chevron--open' : ''}`}>
          {'>'}
        </span>
        <span className="template-section__heading">
          <span className="template-section__title">{title}</span>
        </span>
      </button>
      <div className="template-section__controls">
        {count !== undefined ? <span className="template-section__count">{count}</span> : null}
        {actions}
      </div>
      {isOpen ? children : null}
    </div>
  )
}

export function TemplatesTab({
  curveDictionaryEntries,
  lithologyDictionaryEntries,
  models,
  selectedModelId,
  selectedCurveDictionaryEntryId,
  selectedLithologyDictionaryEntryId,
  onSelectModel,
  onSelectCurveDictionaryEntry,
  onSelectLithologyDictionaryEntry,
  onActivateModel,
  onDeleteModelById,
  onCreateModel,
  onContextMenuModel,
}: TemplatesTabProps) {
  return (
    <div className="sidebar-panel__body">
      <TemplateSection
        title="Compaction Presets"
        count={models.length}
        defaultOpen
        actions={(
          <button
            type="button"
            className="project-dialog__button project-dialog__button--primary"
            style={{ fontSize: '0.76rem' }}
            onClick={(event) => {
              event.stopPropagation()
              onCreateModel()
            }}
          >
            + New preset
          </button>
        )}
      >
        <div className="strat-chart-list template-section__content">
          {models.map((model) => (
            <div
              key={model.id}
              className={`strat-chart-item ${model.is_active ? 'strat-chart-item--active' : ''} ${selectedModelId === model.id ? 'strat-chart-item--selected' : ''}`}
              onClick={() => onSelectModel(model.id)}
              onContextMenu={(event) => {
                onSelectModel(model.id)
                onContextMenuModel(event, model)
              }}
            >
              <div className="strat-chart-item__content">
                <span className="strat-chart-item__name">{model.name}</span>
              </div>
              {model.is_builtin ? (
                <span className="strat-chart-item__meta">built-in</span>
              ) : null}
              {model.is_active ? (
                <span className="strat-chart-item__status">active</span>
              ) : (
                <button
                  type="button"
                  className="strat-chart-item__activate"
                  onClick={(event) => {
                    event.stopPropagation()
                    onActivateModel(model.id)
                  }}
                >
                  Set active
                </button>
              )}
              <button
                type="button"
                className="strat-chart-item__delete"
                title={
                  model.is_builtin ? 'Built-in preset cannot be deleted'
                  : model.is_active ? 'Activate another preset first'
                  : 'Delete this preset'
                }
                disabled={model.is_builtin || model.is_active}
                onClick={(event) => {
                  event.stopPropagation()
                  if (window.confirm(`Delete compaction preset "${model.name}"?`)) {
                    onDeleteModelById(model.id, model.name, model.is_builtin, model.is_active)
                  }
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      </TemplateSection>

      <TemplateSection
        title="Curve Mnemonics"
        count={curveDictionaryEntries.length}
      >
        <div className="template-table-wrapper">
          <table className="template-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Scope</th>
                <th>Family</th>
                <th>Canonical</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {curveDictionaryEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={selectedCurveDictionaryEntryId === entry.id ? 'template-table__row--selected' : ''}
                  onClick={() => onSelectCurveDictionaryEntry(entry.id)}
                >
                  <td>{entry.pattern}</td>
                  <td>{entry.scope}</td>
                  <td>{entry.family_code ?? '-'}</td>
                  <td>{entry.canonical_mnemonic ?? '-'}</td>
                  <td>{entry.canonical_unit ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TemplateSection>

      <TemplateSection
        title="Lithologies"
        count={lithologyDictionaryEntries.length}
      >
        <div className="template-table-wrapper">
          <table className="template-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Color</th>
                <th>Density</th>
                <th>Phi0</th>
                <th>C</th>
              </tr>
            </thead>
            <tbody>
              {lithologyDictionaryEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={selectedLithologyDictionaryEntryId === entry.id ? 'template-table__row--selected' : ''}
                  onClick={() => onSelectLithologyDictionaryEntry(entry.id)}
                >
                  <td>{entry.lithology_code}</td>
                  <td>{entry.display_name}</td>
                  <td>
                    <span className="template-color-chip" style={{ backgroundColor: entry.color_hex }} />
                    {entry.color_hex}
                  </td>
                  <td>{entry.density.toFixed(0)}</td>
                  <td>{entry.porosity_surface.toFixed(2)}</td>
                  <td>{entry.compaction_coeff.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TemplateSection>
    </div>
  )
}
