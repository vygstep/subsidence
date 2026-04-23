import type { LithologyDictionaryEntry } from '@/types'

export function LithologyDictionarySettings({ entry }: { entry: LithologyDictionaryEntry }) {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Lithology Entry</div>
        <div className="template-panel__value">{entry.display_name}</div>
      </div>
      <div className="tree-leaf"><span>Code</span><span>{entry.lithology_code}</span></div>
      <div className="tree-leaf"><span>Name</span><span>{entry.display_name}</span></div>
      <div className="tree-leaf"><span>Color</span><span>{entry.color_hex}</span></div>
      <div className="tree-leaf"><span>Pattern</span><span>{entry.pattern_id ?? 'Solid fill'}</span></div>
      <div className="tree-leaf"><span>Sort order</span><span>{entry.sort_order}</span></div>
      <div className="tree-leaf"><span>Density</span><span>{entry.density.toFixed(0)}</span></div>
      <div className="tree-leaf"><span>Phi0</span><span>{entry.porosity_surface.toFixed(2)}</span></div>
      <div className="tree-leaf"><span>C</span><span>{entry.compaction_coeff.toFixed(3)}</span></div>
      <div className="tree-leaf"><span>Description</span><span>{entry.description ?? 'None'}</span></div>
      <p className="sidebar-panel__empty">
        This entry is currently read-only. Editing will be enabled in a later templates step.
      </p>
    </div>
  )
}
