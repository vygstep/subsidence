import { useDataManager } from './dataManager/DataManagerContext'
import type {
  CompactionPresetSummary,
  CurveMnemonicSetSummary,
  LithologySetSummary,
  UnitDimensionSummary,
} from '@/types'

interface TemplatesTabProps {
  mnemonicSets: CurveMnemonicSetSummary[]
  unitDimensions: UnitDimensionSummary[]
  lithologySets: LithologySetSummary[]
  compactionPresets: CompactionPresetSummary[]
  isCompactionPresetsRootSelected: boolean
  isCurveMnemonicsRootSelected: boolean
  isLithologiesRootSelected: boolean
  isMeasurementUnitsRootSelected: boolean
  selectedCompactionPresetId: number | null
  selectedMnemonicSetId: number | null
  selectedUnitDimensionCode: string | null
  selectedLithologySetId: number | null
  onCreateCompactionPresetDraft: () => void
  onCreateMnemonicSet: () => void
  onSelectCompactionPresetsRoot: () => void
  onSelectCompactionPreset: (presetId: number) => void
  onSelectCurveMnemonicsRoot: () => void
  onSelectMnemonicSet: (setId: number) => void
  onSelectMeasurementUnitsRoot: () => void
  onSelectUnitDimension: (dimensionCode: string) => void
  onSelectLithologiesRoot: () => void
  onSelectLithologySet: (setId: number) => void
}

function CountBadge({ count }: { count: number }) {
  return <span className="template-section__count">{count}</span>
}

export function TemplatesTab({
  mnemonicSets,
  unitDimensions,
  lithologySets,
  compactionPresets,
  isCompactionPresetsRootSelected,
  isCurveMnemonicsRootSelected,
  isLithologiesRootSelected,
  isMeasurementUnitsRootSelected,
  selectedCompactionPresetId,
  selectedMnemonicSetId,
  selectedUnitDimensionCode,
  selectedLithologySetId,
  onCreateCompactionPresetDraft,
  onCreateMnemonicSet,
  onSelectCompactionPresetsRoot,
  onSelectCompactionPreset,
  onSelectCurveMnemonicsRoot,
  onSelectMnemonicSet,
  onSelectMeasurementUnitsRoot,
  onSelectUnitDimension,
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
              &gt;
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
          <div className={`tree-node__row ${isCurveMnemonicsRootSelected ? 'tree-node__row--selected' : ''}`}>
            <button
              type="button"
              className={`tree-toggle ${isExpanded('template:curve-mnemonics') ? 'tree-toggle--open' : ''}`}
              onClick={() => toggleExpanded('template:curve-mnemonics')}
              aria-label={isExpanded('template:curve-mnemonics') ? 'Collapse' : 'Expand'}
            >
              &gt;
            </button>
            <button
              type="button"
              className="tree-node__section-label"
              onClick={onSelectCurveMnemonicsRoot}
            >
              Curve Mnemonics
            </button>
            <CountBadge count={mnemonicSets.length} />
          </div>
          {isExpanded('template:curve-mnemonics') ? (
            <div className="tree-node__children">
              {mnemonicSets.map((set) => (
                <div
                  key={set.id}
                  className={selectedMnemonicSetId === set.id ? 'tree-node__item-selected' : ''}
                  onClick={() => onSelectMnemonicSet(set.id)}
                >
                  <div className="tree-checkbox-leaf">
                    <span className="tree-checkbox-leaf__label">{set.name}</span>
                    <span className="tree-checkbox-leaf__meta">{set.is_builtin ? 'built-in' : set.entry_count}</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="dm-action dm-action--primary"
                onClick={(event) => {
                  event.stopPropagation()
                  onCreateMnemonicSet()
                }}
              >
                + New set
              </button>
            </div>
          ) : null}
        </div>

        {/* Measurement Units */}
        <div className="tree-node">
          <div className={`tree-node__row ${isMeasurementUnitsRootSelected ? 'tree-node__row--selected' : ''}`}>
            <button
              type="button"
              className={`tree-toggle ${isExpanded('template:measurement-units') ? 'tree-toggle--open' : ''}`}
              onClick={() => toggleExpanded('template:measurement-units')}
              aria-label={isExpanded('template:measurement-units') ? 'Collapse' : 'Expand'}
            >
              &gt;
            </button>
            <button
              type="button"
              className="tree-node__section-label"
              onClick={onSelectMeasurementUnitsRoot}
            >
              Measurement Units
            </button>
            <CountBadge count={unitDimensions.length} />
          </div>
          {isExpanded('template:measurement-units') ? (
            <div className="tree-node__children">
              {unitDimensions.map((dimension) => (
                <div
                  key={dimension.code}
                  className={selectedUnitDimensionCode === dimension.code ? 'tree-node__item-selected' : ''}
                  onClick={() => onSelectUnitDimension(dimension.code)}
                >
                  <div className="tree-checkbox-leaf">
                    <span className="tree-checkbox-leaf__label">{dimension.display_name}</span>
                    <span className="tree-checkbox-leaf__meta">{dimension.unit_count}</span>
                  </div>
                </div>
              ))}
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
              &gt;
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
