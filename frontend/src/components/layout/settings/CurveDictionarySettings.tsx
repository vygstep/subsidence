import type { CurveDictionaryEntry } from '@/types'

export function CurveDictionarySettings({ entry }: { entry: CurveDictionaryEntry }) {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Curve Dictionary Rule</div>
        <div className="template-panel__value">{entry.pattern}</div>
      </div>
      <div className="tree-leaf"><span>Scope</span><span>{entry.scope}</span></div>
      <div className="tree-leaf"><span>Pattern</span><span>{entry.pattern}</span></div>
      <div className="tree-leaf"><span>Match mode</span><span>{entry.is_regex ? 'Regex' : 'Wildcard'}</span></div>
      <div className="tree-leaf"><span>Priority</span><span>{entry.priority}</span></div>
      <div className="tree-leaf"><span>Family</span><span>{entry.family_code ?? 'Unassigned'}</span></div>
      <div className="tree-leaf"><span>Canonical mnemonic</span><span>{entry.canonical_mnemonic ?? 'Unassigned'}</span></div>
      <div className="tree-leaf"><span>Canonical unit</span><span>{entry.canonical_unit ?? 'Unassigned'}</span></div>
      <div className="tree-leaf"><span>Status</span><span>{entry.is_active ? 'Active' : 'Disabled'}</span></div>
      <p className="sidebar-panel__empty">
        This entry is currently read-only. Editing will be enabled in a later templates step.
      </p>
    </div>
  )
}
