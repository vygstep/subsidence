import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import type { WellInventory } from '@/types'
import { downloadResponse } from '@/utils/exportDownload'

import { ExportLocationControls } from './export'
import { getLastExportRoot, rememberExportRoot } from './pathMemory'

type ExportScope = 'current' | 'all'
type TablePackaging = 'one_file_for_all_wells' | 'one_file_per_well'

interface ExportWellDeviationDialogProps {
  initialScope: ExportScope
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

async function postDeviationExport(payload: Record<string, unknown>): Promise<Response> {
  return fetch('/api/export/wells/deviation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function ExportWellDeviationDialog({
  initialScope,
  activeWellId,
  wells,
  onClose,
}: ExportWellDeviationDialogProps) {
  const [scope] = useState<ExportScope>(initialScope)
  const [packaging, setPackaging] = useState<TablePackaging>('one_file_for_all_wells')
  const [exportToZip, setExportToZip] = useState(false)
  const [exportRoot, setExportRoot] = useState(() => getLastExportRoot())
  const [lastWrittenPath, setLastWrittenPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentWell = activeWellId ? wells.find((well) => well.well_id === activeWellId) ?? null : null
  const exportableWells = useMemo(() => wells.filter((well) => well.deviation !== null && well.deviation !== undefined), [wells])
  const title = scope === 'current' ? 'Export current well deviation CSV' : 'Export all wells deviation CSV'
  const canSubmit = scope === 'all'
    ? exportableWells.length > 0
    : currentWell !== null && currentWell.deviation !== null && currentWell.deviation !== undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setIsSubmitting(true)
    setLastWrittenPath(null)
    const outputDir = exportRoot.trim() || null
    if (outputDir) {
      rememberExportRoot(outputDir)
    }

    try {
      if (scope === 'current') {
        const response = await postDeviationExport({
          scope: 'current',
          well_id: currentWell?.well_id,
          output_dir: outputDir,
        })
        if (outputDir) {
          if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
          const payload = (await response.json()) as ExportWriteResponse
          setLastWrittenPath(payload.files[0]?.path ?? outputDir)
        } else {
          await downloadResponse(response, `${currentWell?.well_name ?? 'well'}_deviation.csv`)
        }
        return
      }

      if (packaging === 'one_file_per_well' && !exportToZip && !outputDir) {
        for (const well of exportableWells) {
          // eslint-disable-next-line no-await-in-loop
          const response = await postDeviationExport({ scope: 'current', well_id: well.well_id })
          // eslint-disable-next-line no-await-in-loop
          await downloadResponse(response, `${well.well_name}_deviation.csv`)
        }
        return
      }

      const response = await postDeviationExport({
        scope: 'all',
        packaging,
        export_to_zip: packaging === 'one_file_per_well' ? exportToZip : false,
        output_dir: outputDir,
      })
      if (outputDir) {
        if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
        const payload = (await response.json()) as ExportWriteResponse
        setLastWrittenPath(payload.files[0]?.path ?? outputDir)
      } else {
        await downloadResponse(response, exportToZip ? 'deviation.zip' : 'deviation.csv')
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
            <label className="project-dialog__field">
              <span>Packaging</span>
              <select
                value={packaging}
                onChange={(event) => {
                  const next = event.target.value as TablePackaging
                  setPackaging(next)
                  if (next === 'one_file_for_all_wells') {
                    setExportToZip(false)
                  }
                }}
              >
                <option value="one_file_for_all_wells">One file for all wells</option>
                <option value="one_file_per_well">One file by well</option>
              </select>
            </label>
            {packaging === 'one_file_per_well' ? (
              <label className="project-dialog__checkbox">
                <input
                  type="checkbox"
                  checked={exportToZip}
                  onChange={(event) => setExportToZip(event.target.checked)}
                />
                Export to ZIP
              </label>
            ) : null}
          </div>
        ) : null}

        <ExportLocationControls
          exportRoot={exportRoot}
          onExportRootChange={setExportRoot}
          lastWrittenPath={lastWrittenPath}
          error={error}
          onError={setError}
        />

        {scope === 'all' && packaging === 'one_file_per_well' && !exportToZip && !exportRoot.trim() ? (
          <p className="project-dialog__hint">
            Browser settings may block multiple downloads. Choose an export folder or ZIP if that happens.
          </p>
        ) : null}
        {!canSubmit ? <p className="project-dialog__error">No deviation surveys are available for export.</p> : null}
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
