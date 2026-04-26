import { useEffect, useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { LithologyPatternPaletteDetail, LithologyPatternPaletteSummary } from '@/types'
import { LithologyPatternPreview } from './LithologyPatternPreview'

export function LithologyPatternPaletteSettings({ palette }: { palette: LithologyPatternPaletteSummary }) {
  const fetchPalette = useWellDataStore((state) => state.fetchLithologyPatternPalette)
  const createPalette = useWellDataStore((state) => state.createLithologyPatternPalette)
  const loadPalettes = useWellDataStore((state) => state.loadLithologyPatternPalettes)
  const updatePalette = useWellDataStore((state) => state.updateLithologyPatternPalette)
  const deletePalette = useWellDataStore((state) => state.deleteLithologyPatternPalette)
  const importPattern = useWellDataStore((state) => state.importLithologyPattern)
  const deletePattern = useWellDataStore((state) => state.deleteLithologyPattern)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  const [detail, setDetail] = useState<LithologyPatternPaletteDetail | null>(null)

  async function reloadPalette() {
    const next = await fetchPalette(palette.id)
    setDetail(next)
  }

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    void fetchPalette(palette.id).then((next) => {
      if (!cancelled) setDetail(next)
    })
    return () => { cancelled = true }
  }, [fetchPalette, palette.id])

  async function handleCopy() {
    const name = window.prompt('Copy pattern palette as:', `${resolved.name} Copy`)?.trim()
    if (!name) return
    try {
      const copied = await createPalette(name, resolved.id)
      await loadPalettes()
      setSelectedObject({ type: 'lithology-pattern-palette', paletteId: copied.id })
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleRename() {
    const name = window.prompt('Rename pattern palette', resolved.name)?.trim()
    if (!name) return
    try {
      const updated = await updatePalette(resolved.id, { name })
      setDetail((current) => (current ? { ...current, name: updated.name } : current))
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleDeletePalette() {
    if (!window.confirm(`Delete pattern palette "${resolved.name}"?`)) return
    try {
      await deletePalette(resolved.id)
      setSelectedObject({ type: 'pattern-palettes-root' })
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleImportPattern() {
    const path = window.prompt('SVG file path to import:')?.trim()
    if (!path) return
    const displayName = window.prompt('Pattern display name:', '')?.trim()
    try {
      await importPattern(resolved.id, {
        path,
        display_name: displayName || null,
      })
      await reloadPalette()
    } catch (error) {
      window.alert(String(error))
      await reloadPalette()
    }
  }

  async function handleDeletePattern(patternId: number, displayName: string) {
    if (!window.confirm(`Delete pattern "${displayName}"?`)) return
    try {
      await deletePattern(resolved.id, patternId)
      setDetail((current) => (
        current
          ? {
            ...current,
            entry_count: Math.max(0, current.entry_count - 1),
            patterns: current.patterns.filter((pattern) => pattern.id !== patternId),
          }
          : current
      ))
    } catch (error) {
      window.alert(String(error))
      await reloadPalette()
    }
  }

  const resolved = detail ?? { ...palette, description: null, patterns: [] }

  return (
    <div className={`template-panel ${resolved.is_builtin ? 'template-panel--muted' : ''}`}>
      <div className="template-panel__group">
        <div className="template-panel__label">Pattern Palette</div>
        <div className="template-panel__value">{resolved.name}</div>
      </div>
      <div className="template-panel__group">
        <div className="template-panel__label">Origin</div>
        <div className="template-panel__value">{`${resolved.origin}${resolved.license_name ? ` / ${resolved.license_name}` : ''}`}</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Code</th>
              <th>Name</th>
              <th>Tile</th>
              <th>Source</th>
              {!resolved.is_builtin ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {resolved.patterns.map((pattern) => (
              <tr key={pattern.id} className={resolved.is_builtin ? 'dm-table__row--builtin' : ''}>
                <td><LithologyPatternPreview pattern={pattern} /></td>
                <td>{pattern.code}</td>
                <td>{pattern.display_name}</td>
                <td>{`${pattern.tile_width}x${pattern.tile_height}`}</td>
                <td>{pattern.source_code ?? pattern.source_path ?? '-'}</td>
                {!resolved.is_builtin ? (
                  <td>
                    <button
                      type="button"
                      className="dm-action dm-action--danger"
                      onClick={() => void handleDeletePattern(pattern.id, pattern.display_name)}
                    >
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="template-settings__actions">
        {!resolved.is_builtin ? (
          <>
            <button type="button" className="project-dialog__button" onClick={() => void handleRename()}>
              Rename
            </button>
            <button type="button" className="project-dialog__button" onClick={() => void handleImportPattern()}>
              Import SVG
            </button>
            <button type="button" className="project-dialog__button" onClick={() => void handleDeletePalette()}>
              Delete
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void handleCopy()}
        >
          Make copy
        </button>
      </div>
      <p className="sidebar-panel__empty">
        {resolved.is_builtin
          ? 'Built-in pattern palettes are read-only.'
          : 'Imported SVG patterns are validated before storage.'}
      </p>
    </div>
  )
}
