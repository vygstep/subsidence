import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { LithologySetSummary } from '@/types'

export function LithologySetsRootSettings({ sets }: { sets: LithologySetSummary[] }) {
  const createLithologySet = useWellDataStore((state) => state.createLithologySet)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  async function handleCreateSet() {
    const name = window.prompt('New lithology set name:', 'New Lithology Set')?.trim()
    if (!name) return
    try {
      const created = await createLithologySet(name)
      setSelectedObject({ type: 'lithology-set', setId: created.id })
    } catch (error) {
      window.alert(String(error))
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Lithologies</div>
        <div className="template-panel__value">{sets.length}</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table">
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
      <div className="template-settings__actions">
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void handleCreateSet()}
        >
          + New set
        </button>
      </div>
    </div>
  )
}
