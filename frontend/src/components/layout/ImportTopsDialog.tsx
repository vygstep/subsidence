import { useState } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

interface WellOption {
  well_id: string
  well_name: string
}

interface ImportTopsDialogProps {
  wells: WellOption[]
  activeWellId?: string | null
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportTopsResponse {
  well_id: string
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) {
      return payload.detail
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback
}

export function ImportTopsDialog({ wells, activeWellId, onClose, onSuccess }: ImportTopsDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [wellId, setWellId] = useState(activeWellId ?? '')
  const [createNewWell, setCreateNewWell] = useState(false)
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [depthRef, setDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = csvPath.trim()
    if (!nextPath) {
      setError('CSV path is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation('import.tops', async () => {
        const response = await fetch('/api/projects/import-tops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            well_id: wellId || null,
            csv_path: nextPath,
            depth_ref: depthRef,
            create_new_well: !wellId && createNewWell,
          }),
        })
        if (!response.ok) {
          throw new Error(await readError(response, `Failed to import tops (${response.status})`))
        }

        const payload = (await response.json()) as ImportTopsResponse
        rememberImportPath(nextPath)
        await onSuccess(payload.well_id)
        onClose()
      }, {
        projectPath,
        activeWellId: wellId || activeWellId || null,
        details: { inputPath: nextPath, depthRef, createNewWell },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import tops')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const picked = await pickFile(csvPath || lastImportRoot, [
        ['Delimited text', '*.csv *.tsv *.txt'],
        ['CSV files', '*.csv'],
        ['TSV files', '*.tsv'],
        ['All files', '*.*'],
      ])
      if (picked) {
        setCsvPath(picked)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open file picker')
    }
  }

  return (
    <section className="project-dialog" aria-labelledby="import-tops-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Phase 3</p>
          <h2 id="import-tops-title" className="project-dialog__title">Load Tops</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>Target well</span>
          <select value={wellId} onChange={(event) => setWellId(event.target.value)}>
            <option value="">Reuse by file well_name / create from defaults</option>
            {wells.map((well) => (
              <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
            ))}
          </select>
        </label>

        <label className="project-dialog__checkbox">
          <input
            type="checkbox"
            checked={createNewWell}
            disabled={Boolean(wellId)}
            onChange={(event) => setCreateNewWell(event.target.checked)}
          />
          <span>Create new well if a matching well already exists</span>
        </label>

        <label className="project-dialog__field">
          <span>Tops CSV path</span>
          <div className="project-dialog__field-row">
            <input
              type="text"
              value={csvPath}
              onChange={(event) => setCsvPath(event.target.value)}
              placeholder="D:\\data\\tops.csv"
              autoFocus
            />
            <div className="project-dialog__path-actions">
              <button type="button" className="project-dialog__path-action" disabled={!lastImportRoot} onClick={() => setCsvPath(lastImportRoot)}>
                Use last folder
              </button>
              <button type="button" className="project-dialog__path-action" onClick={() => void handleBrowse()}>
                Browse...
              </button>
            </div>
          </div>
        </label>

        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={depthRef} onChange={(event) => setDepthRef(event.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD</option>
            <option value="TVD">TVD</option>
            <option value="TVDSS">TVDSS</option>
          </select>
        </label>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Importing...' : 'Load tops'}
          </button>
        </div>
      </form>
    </section>
  )
}
