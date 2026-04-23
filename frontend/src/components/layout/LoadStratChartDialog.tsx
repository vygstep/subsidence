import { useState } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

interface LoadStratChartDialogProps {
  onClose: () => void
  onSuccess: (unitsImported: number) => void
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) return payload.detail
  } catch {
    // ignore
  }
  return fallback
}

export function LoadStratChartDialog({ onClose, onSuccess }: LoadStratChartDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const path = csvPath.trim()
    if (!path) {
      setError('CSV path is required')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation('strat_chart.import', async () => {
        const response = await fetch('/api/strat-charts/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv_path: path }),
        })
        if (!response.ok) {
          throw new Error(await readError(response, `Import failed (${response.status})`))
        }
        const payload = (await response.json()) as { units_imported: number }
        rememberImportPath(path)
        onSuccess(payload.units_imported)
        onClose()
      }, { projectPath, details: { inputPath: path } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed')
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
    <section className="project-dialog" aria-labelledby="load-strat-chart-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">StratChart</p>
          <h2 id="load-strat-chart-title" className="project-dialog__title">Load Stratigraphic Chart</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>ICS chart CSV path</span>
          <div className="project-dialog__field-row">
            <input
              type="text"
              value={csvPath}
              onChange={(event) => setCsvPath(event.target.value)}
              placeholder="D:\\data\\ics_chart2023.csv"
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

        <p className="project-dialog__hint">
          Expected columns: unit_id, parent_unit_id, unit_name, rank_name, start_age_ma, end_age_ma, html_rgb_hash
        </p>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Importing...' : 'Load chart'}
          </button>
        </div>
      </form>
    </section>
  )
}
