import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { CurveMnemonicSetSummary } from '@/types'

export function CurveMnemonicSetsRootSettings({ sets }: { sets: CurveMnemonicSetSummary[] }) {
  const createMnemonicSet = useWellDataStore((state) => state.createMnemonicSet)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  async function handleCreateSet() {
    const name = window.prompt('New mnemonic set name:', 'New Mnemonic Set')?.trim()
    if (!name) return
    try {
      const created = await createMnemonicSet(name)
      setSelectedObject({ type: 'mnemonic-set', setId: created.id })
    } catch (error) {
      window.alert(String(error))
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Curve Mnemonics</div>
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
              <tr key={set.id} className={set.is_builtin ? 'dm-table__row--builtin' : ''}>
                <td>{set.name}</td>
                <td>{set.is_builtin ? 'Built-in' : 'User'}</td>
                <td>{set.entry_count}</td>
              </tr>
            ))}
            {sets.length === 0 ? (
              <tr className="dm-table__empty-row">
                <td colSpan={3}>No mnemonic sets loaded.</td>
              </tr>
            ) : null}
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
