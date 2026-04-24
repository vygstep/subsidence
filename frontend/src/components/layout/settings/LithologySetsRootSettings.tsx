import type { LithologySetSummary } from '@/types'

export function LithologySetsRootSettings({ sets }: { sets: LithologySetSummary[] }) {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Lithologies</div>
        <div className="template-panel__value">{sets.length}</div>
      </div>
      <div className="template-table-wrapper">
        <table className="template-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Entries</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set) => (
              <tr key={set.id}>
                <td>{set.name}</td>
                <td>{set.is_builtin ? 'Built-in' : 'User'}</td>
                <td>{set.entry_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sidebar-panel__empty">
        Select a lithology set in Templates to inspect its table.
      </p>
    </div>
  )
}
