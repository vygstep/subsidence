import { useState } from 'react'

import type {
  CompactionPresetSummary,
  CurveDictionaryEntry,
  LithologySetSummary,
} from '@/types'

interface TemplatesTabProps {
  curveDictionaryEntries: CurveDictionaryEntry[]
  lithologySets: LithologySetSummary[]
  compactionPresets: CompactionPresetSummary[]
  isCompactionPresetsRootSelected: boolean
  isLithologiesRootSelected: boolean
  selectedCompactionPresetId: number | null
  selectedCurveDictionaryEntryId: number | null
  selectedLithologySetId: number | null
  onCreateCompactionPresetDraft: () => void
  onSelectCompactionPresetsRoot: () => void
  onSelectCompactionPreset: (presetId: number) => void
  onSelectCurveDictionaryEntry: (entryId: number) => void
  onSelectLithologiesRoot: () => void
  onSelectLithologySet: (setId: number) => void
}

interface TemplateSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  isSelected?: boolean
  onSelect?: () => void
  children: React.ReactNode
}

function TemplateSection({
  title,
  count,
  defaultOpen = false,
  isSelected = false,
  onSelect,
  children,
}: TemplateSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="template-section">
      <button
        type="button"
        className={`template-section__toggle ${isSelected ? 'template-section__toggle--selected' : ''}`}
        onClick={() => {
          setIsOpen((open) => !open)
          onSelect?.()
        }}
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
      </div>
      {isOpen ? children : null}
    </div>
  )
}

export function TemplatesTab({
  curveDictionaryEntries,
  lithologySets,
  compactionPresets,
  isCompactionPresetsRootSelected,
  isLithologiesRootSelected,
  selectedCompactionPresetId,
  selectedCurveDictionaryEntryId,
  selectedLithologySetId,
  onCreateCompactionPresetDraft,
  onSelectCompactionPresetsRoot,
  onSelectCompactionPreset,
  onSelectCurveDictionaryEntry,
  onSelectLithologiesRoot,
  onSelectLithologySet,
}: TemplatesTabProps) {
  return (
    <div className="sidebar-panel__body">
      <TemplateSection
        title="Compaction Presets"
        count={compactionPresets.length}
        defaultOpen
        isSelected={isCompactionPresetsRootSelected}
        onSelect={onSelectCompactionPresetsRoot}
      >
        <div className="strat-chart-list template-section__content">
          {compactionPresets.map((preset) => (
            <div
              key={preset.id}
              className={`strat-chart-item ${preset.is_builtin ? 'strat-chart-item--muted' : ''} ${selectedCompactionPresetId === preset.id ? 'strat-chart-item--selected' : ''}`}
              onClick={() => onSelectCompactionPreset(preset.id)}
            >
              <div className="strat-chart-item__content">
                <span className="strat-chart-item__name">{preset.name}</span>
              </div>
              <span className="strat-chart-item__meta">{preset.is_builtin ? 'built-in' : 'user'}</span>
            </div>
          ))}
          <button
            type="button"
            className="template-section__inline-action"
            onClick={(event) => {
              event.stopPropagation()
              onCreateCompactionPresetDraft()
            }}
          >
            + New preset
          </button>
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
        count={lithologySets.length}
        isSelected={isLithologiesRootSelected}
        onSelect={onSelectLithologiesRoot}
      >
        <div className="strat-chart-list template-section__content">
          {lithologySets.map((set) => (
            <div
              key={set.id}
              className={`strat-chart-item ${set.is_builtin ? 'strat-chart-item--muted' : ''} ${selectedLithologySetId === set.id ? 'strat-chart-item--selected' : ''}`}
              onClick={() => onSelectLithologySet(set.id)}
            >
              <div className="strat-chart-item__content">
                <span className="strat-chart-item__name">{set.name}</span>
              </div>
              <span className="strat-chart-item__meta">{set.entry_count}</span>
            </div>
          ))}
        </div>
      </TemplateSection>
    </div>
  )
}
