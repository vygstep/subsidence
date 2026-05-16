import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import type { WellInventory } from '@/types'
import { downloadResponse } from '@/utils/exportDownload'

import { ExportLocationControls } from './export'
import { getLastExportRoot, rememberExportRoot } from './pathMemory'

type ExportScope = 'current' | 'all'
type LogsExportFormat = 'csv' | 'las'

interface ExportWellLogsDialogProps {
  initialScope: ExportScope
  exportFormat: LogsExportFormat
  activeWellId: string | null
  wells: WellInventory[]
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

async function postLogsExport(format: LogsExportFormat, payload: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/export/wells/logs/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function ExportWellLogsDialog({
  initialScope,
  exportFormat,
  activeWellId,
  wells,
  onClose,
}: ExportWellLogsDialogProps) {
  const [scope] = useState<ExportScope>(initialScope)
  const [exportToZip, setExportToZip] = useState(false)
  const [exportRoot, setExportRoot] = useState(() => getLastExportRoot())
  const [lasStepM, setLasStepM] = useState('0.2')
  const [lasNullValue, setLasNullValue] = useState('-999.25')
  const [lastWrittenPath, setLastWrittenPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentWell = activeWellId ? wells.find((well) => well.well_id === activeWellId) ?? null : null
  const exportableWells = useMemo(
    () => wells.filter((well) => well.curves.length > 0),
    [wells],
  )
  const canSubmit = scope === 'all'
    ? exportableWells.length > 0
    : currentWell !== null && currentWell.curves.length > 0
  const noun = exportFormat.toUpperCase()
  const title = scope === 'current' ? `Export current well logs ${noun}` : `Export all wells logs ${noun}`

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    const parsedLasStepM = Number.parseFloat(lasStepM)
    const parsedLasNullValue = Number.parseFloat(lasNullValue)
    if (exportFormat === 'las') {
      if (!Number.isFinite(parsedLasStepM) || parsedLasStepM <= 0) {
        setError('LAS step must be a positive number.')
        return
      }
      if (!Number.isFinite(parsedLasNullValue)) {
        setError('LAS null value must be a finite number.')
        return
      }
    }
    const lasSettings = exportFormat === 'las'
      ? {
          las_step_m: parsedLasStepM,
          las_null_value: parsedLasNullValue,
        }
      : {}
    setIsSubmitting(true)
    setLastWrittenPath(null)
    const outputDir = exportRoot.trim() || null
    if (outputDir) {
      rememberExportRoot(outputDir)
    }

    try {
      if (scope === 'current') {
        const response = await postLogsExport(exportFormat, {
          scope: 'current',
          well_id: currentWell?.well_id,
          output_dir: outputDir,
          ...lasSettings,
        })
        if (outputDir) {
          if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
          const payload = (await response.json()) as ExportWriteResponse
          setLastWrittenPath(payload.files[0]?.path ?? outputDir)
        } else {
          await downloadResponse(response, `${currentWell?.well_name ?? 'well'}_logs.${exportFormat}`)
        }
        onClose()
        return
      }

      if (!exportToZip && !outputDir) {
        for (const well of exportableWells) {
          // eslint-disable-next-line no-await-in-loop
          const response = await postLogsExport(exportFormat, { scope: 'current', well_id: well.well_id, ...lasSettings })
          // eslint-disable-next-line no-await-in-loop
          await downloadResponse(response, `${well.well_name}_logs.${exportFormat}`)
        }
        onClose()
        return
      }

      const response = await postLogsExport(exportFormat, {
        scope: 'all',
        export_to_zip: exportToZip,
        output_dir: outputDir,
        ...lasSettings,
      })
      if (outputDir) {
        if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
        const payload = (await response.json()) as ExportWriteResponse
        setLastWrittenPath(payload.files[0]?.path ?? outputDir)
      } else {
        await downloadResponse(response, `well_logs_${exportFormat}.zip`)
      }
      onClose()
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

        {exportFormat === 'las' ? (
          <div className="project-dialog__section">
            <div className="project-dialog__field-row">
              <label className="project-dialog__field">
                <span>Step (m)</span>
                <input
                  type="number"
                  step="any"
                  value={lasStepM}
                  onChange={(event) => setLasStepM(event.target.value)}
                />
              </label>
              <label className="project-dialog__field">
                <span>Null value</span>
                <input
                  type="number"
                  step="any"
                  value={lasNullValue}
                  onChange={(event) => setLasNullValue(event.target.value)}
                />
              </label>
            </div>
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
        {!canSubmit ? <p className="project-dialog__error">No log curves are available for export.</p> : null}

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
