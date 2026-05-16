import { useState } from 'react'
import type { FormEvent } from 'react'

import type { StratChartInfo } from '@/types'
import { downloadResponse } from '@/utils/exportDownload'

import { ExportLocationControls } from './export'
import { getLastExportRoot, rememberExportRoot } from './pathMemory'

type ExportScope = 'active' | 'all'

interface ExportStratChartDialogProps {
  initialScope: ExportScope
  charts: StratChartInfo[]
  onClose: () => void
}

interface ExportWriteResponse {
  status: string
  files: Array<{ filename: string; path: string; byte_size: number }>
  file_count: number
}

async function readExportError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    return payload.detail ?? fallback
  } catch {
    return fallback
  }
}

async function postStratChartExport(payload: Record<string, unknown>): Promise<Response> {
  return fetch('/api/export/strat-charts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function ExportStratChartDialog({ initialScope, charts, onClose }: ExportStratChartDialogProps) {
  const [scope] = useState<ExportScope>(initialScope)
  const [exportToZip, setExportToZip] = useState(false)
  const [exportRoot, setExportRoot] = useState(() => getLastExportRoot())
  const [lastWrittenPath, setLastWrittenPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeChart = charts.find((chart) => chart.is_active) ?? null
  const canSubmit = scope === 'all' ? charts.length > 0 : activeChart !== null
  const title = scope === 'all' ? 'Export all StratCharts' : 'Export active StratChart'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setIsSubmitting(true)
    setLastWrittenPath(null)
    const outputDir = exportRoot.trim() || null
    if (outputDir) rememberExportRoot(outputDir)

    try {
      if (scope === 'active') {
        const response = await postStratChartExport({
          scope: 'active',
          output_dir: outputDir,
        })
        if (outputDir) {
          if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
          const payload = (await response.json()) as ExportWriteResponse
          setLastWrittenPath(payload.files[0]?.path ?? outputDir)
        } else {
          await downloadResponse(response, `${activeChart?.name ?? 'strat_chart'}.csv`)
        }
        return
      }

      if (!exportToZip && !outputDir) {
        for (const chart of charts) {
          // eslint-disable-next-line no-await-in-loop
          const response = await postStratChartExport({ scope: 'selected', chart_id: chart.id })
          // eslint-disable-next-line no-await-in-loop
          await downloadResponse(response, `${chart.name}.csv`)
        }
        return
      }

      const response = await postStratChartExport({
        scope: 'all',
        export_to_zip: exportToZip,
        output_dir: outputDir,
      })
      if (outputDir) {
        if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
        const payload = (await response.json()) as ExportWriteResponse
        setLastWrittenPath(payload.files[0]?.path ?? outputDir)
      } else {
        await downloadResponse(response, 'strat_charts.zip')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="project-dialog" onSubmit={handleSubmit}>
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Export</p>
          <h2 className="project-dialog__title">{title}</h2>
        </div>
      </header>
      <div className="project-dialog__body">
        {scope === 'all' ? (
          <div className="project-dialog__section">
            <label className="project-dialog__checkbox">
              <input
                type="checkbox"
                checked={exportToZip}
                onChange={(event) => setExportToZip(event.target.checked)}
              />
              Export to ZIP
            </label>
          </div>
        ) : null}

        <ExportLocationControls
          exportRoot={exportRoot}
          onExportRootChange={setExportRoot}
          lastWrittenPath={lastWrittenPath}
          error={error}
          onError={setError}
        />

        {scope === 'all' && !exportToZip && !exportRoot.trim() ? (
          <p className="project-dialog__hint">
            Browser settings may block multiple downloads. Choose an export folder or ZIP if that happens.
          </p>
        ) : null}
        {!canSubmit ? <p className="project-dialog__error">No StratChart is available for export.</p> : null}
        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="project-dialog__button project-dialog__button--primary"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </form>
  )
}
