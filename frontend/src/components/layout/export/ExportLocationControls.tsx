import { getLastExportRoot, pickFolder, rememberExportRoot, revealInExplorer } from '../pathMemory'

interface ExportLocationControlsProps {
  exportRoot: string
  onExportRootChange: (path: string) => void
  lastWrittenPath?: string | null
  error?: string | null
  onError?: (message: string | null) => void
}

export function ExportLocationControls({
  exportRoot,
  onExportRootChange,
  lastWrittenPath,
  error,
  onError,
}: ExportLocationControlsProps) {
  async function handleBrowse() {
    onError?.(null)
    try {
      const picked = await pickFolder(exportRoot || getLastExportRoot())
      if (picked) {
        rememberExportRoot(picked)
        onExportRootChange(picked)
      }
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : 'Failed to open folder picker')
    }
  }

  async function handleReveal() {
    if (!lastWrittenPath) return
    onError?.(null)
    try {
      await revealInExplorer(lastWrittenPath)
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : 'Failed to reveal export path')
    }
  }

  return (
    <div className="project-dialog__section">
      <label className="project-dialog__field">
        <span>Export folder</span>
        <input
          type="text"
          value={exportRoot}
          onChange={(event) => onExportRootChange(event.target.value)}
          placeholder="Leave empty to use browser download"
        />
      </label>
      <div className="project-dialog__actions">
        <button type="button" className="project-dialog__button" onClick={handleBrowse}>
          Browse
        </button>
        <button
          type="button"
          className="project-dialog__button"
          onClick={handleReveal}
          disabled={!lastWrittenPath}
        >
          Reveal
        </button>
      </div>
      {error ? <p className="project-dialog__error">{error}</p> : null}
    </div>
  )
}
