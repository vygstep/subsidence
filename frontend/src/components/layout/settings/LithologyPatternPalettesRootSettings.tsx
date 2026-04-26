import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { LithologyPatternPaletteSummary } from '@/types'

export function LithologyPatternPalettesRootSettings({ palettes }: { palettes: LithologyPatternPaletteSummary[] }) {
  const createPalette = useWellDataStore((state) => state.createLithologyPatternPalette)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  async function handleCreatePalette() {
    const name = window.prompt('New pattern palette name:', 'New Pattern Palette')?.trim()
    if (!name) return
    try {
      const created = await createPalette(name)
      setSelectedObject({ type: 'lithology-pattern-palette', paletteId: created.id })
    } catch (error) {
      window.alert(String(error))
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Pattern Palettes</div>
        <div className="template-panel__value">{palettes.length}</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Patterns</th>
              <th>License</th>
            </tr>
          </thead>
          <tbody>
            {palettes.map((palette) => (
              <tr key={palette.id} className={palette.is_builtin ? 'dm-table__row--builtin' : ''}>
                <td>{palette.name}</td>
                <td>{palette.is_builtin ? 'Built-in' : 'User'}</td>
                <td>{palette.entry_count}</td>
                <td>{palette.license_name ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="template-settings__actions">
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void handleCreatePalette()}
        >
          + New palette
        </button>
      </div>
    </div>
  )
}
