import { useDataManager } from './dataManager/DataManagerContext'
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

function CountBadge({ count }: { count: number }) {
  return <span className="template-section__count">{count}</span>
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
  const { isExpanded, toggleExpanded } = useDataManager()

  return (
    <div className="sidebar-panel__body">
      <div className="tree-list">

        {/* Compaction Presets */}
        <div className="tree-node">
          <div className={`tree-node__row ${isCompactionPresetsRootSelected ? 'tree-node__row--selected' : ''}`}>
            <button
              type="button"
              className={`tree-toggle ${isExpanded('template:compaction-presets') ? 'tree-toggle--open' : ''}`}
              onClick={() => toggleExpanded('template:compaction-presets')}
              aria-label={isExpanded('template:compaction-presets') ? 'Collapse' : 'Expand'}
            >
              ▸
            </button>
            <button
              type="button"
              className="tree-node__section-label"
              onClick={onSelectCompactionPresetsRoot}
            >
              Compaction Presets
            </button>
            <CountBadge count={compactionPresets.length} />
          </div>
          {isExpanded('template:compaction-presets') ? (
            <div className="tree-node__children">
              {compactionPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={selectedCompactionPresetId === preset.id ? 'tree-node__item-selected' : ''}
                  onClick={() => onSelectCompactionPreset(preset.id)}
                >
                  <div className="tree-checkbox-leaf">
                    <span className="tree-checkbox-leaf__label">{preset.name}</span>
                    <span className="tree-checkbox-leaf__meta">{preset.is_builtin ? 'built-in' : 'user'}</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="dm-action dm-action--primary"
                onClick={(event) => {
                  event.stopPropagation()
                  onCreateCompactionPresetDraft()
                }}
              >
                + New preset
              </button>
            </div>
          ) : null}
        </div>

        {/* Curve Mnemonics */}
        <div className="tree-node">
          <div className="tree-node__row">
            <button
              type="button"
              className={`tree-toggle ${isExpanded('template:curve-mnemonics') ? 'tree-toggle--open' : ''}`}
              onClick={() => toggleExpanded('template:curve-mnemonics')}
              aria-label={isExpanded('template:curve-mnemonics') ? 'Collapse' : 'Expand'}
            >
              ▸
            </button>
            <button type="button" className="tree-node__section-label">
              Curve Mnemonics
            </button>
            <CountBadge count={curveDictionaryEntries.length} />
          </div>
          {isExpanded('template:curve-mnemonics') ? (
            <div className="tree-node__children">
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
            </div>
          ) : null}
        </div>

        {/* Lithologies */}
        <div className="tree-node">
          <div className={`tree-node__row ${isLithologiesRootSelected ? 'tree-node__row--selected' : ''}`}>
            <button
              type="button"
              className={`tree-toggle ${isExpanded('template:lithologies') ? 'tree-toggle--open' : ''}`}
              onClick={() => toggleExpanded('template:lithologies')}
              aria-label={isExpanded('template:lithologies') ? 'Collapse' : 'Expand'}
            >
              ▸
            </button>
            <button
              type="button"
              className="tree-node__section-label"
              onClick={onSelectLithologiesRoot}
            >
              Lithologies
            </button>
            <CountBadge count={lithologySets.length} />
          </div>
          {isExpanded('template:lithologies') ? (
            <div className="tree-node__children">
              {lithologySets.map((set) => (
                <div
                  key={set.id}
                  className={selectedLithologySetId === set.id ? 'tree-node__item-selected' : ''}
                  onClick={() => onSelectLithologySet(set.id)}
                >
                  <div className="tree-checkbox-leaf">
                    <span className="tree-checkbox-leaf__label">{set.name}</span>
                    <span className="tree-checkbox-leaf__meta">{set.entry_count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}
