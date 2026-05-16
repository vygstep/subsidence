import { useState } from 'react'
import type { FormEvent } from 'react'

import type { SeaLevelCurve } from '@/types'
import { downloadResponse } from '@/utils/exportDownload'

import { ExportLocationControls } from './export'
import { getLastExportRoot, rememberExportRoot } from './pathMemory'

type ExportScope = 'selected' | 'all'

interface ExportSeaLevelCurveDialogProps {
  initialScope: ExportScope
  initialCurveId?: number | null
  curves: SeaLevelCurve[]
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

async function postSeaLevelExport(payload: Record<string, unknown>): Promise<Response> {
  return fetch('/api/export/sea-level-curves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function ExportSeaLevelCurveDialog({
  initialScope,
  initialCurveId = null,
  curves,
  onClose,
}: ExportSeaLevelCurveDialogProps) {
  const [scope] = useState<ExportScope>(initialScope)
  const [curveId, setCurveId] = useState<number | null>(initialCurveId ?? curves[0]?.id ?? null)
  const [exportToZip, setExportToZip] = useState(false)
  const [exportRoot, setExportRoot] = useState(() => getLastExportRoot())
  const [lastWrittenPath, setLastWrittenPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedCurve = curves.find((curve) => curve.id === curveId) ?? null
  const canSubmit = scope === 'all' ? curves.length > 0 : selectedCurve !== null
  const title = scope === 'all' ? 'Export all sea level curves' : 'Export sea level curve'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setIsSubmitting(true)
    setLastWrittenPath(null)
    const outputDir = exportRoot.trim() || null
    if (outputDir) rememberExportRoot(outputDir)

    try {
      if (scope === 'selected') {
        const response = await postSeaLevelExport({
          scope: 'selected',
          curve_id: selectedCurve?.id,
          output_dir: outputDir,
        })
        if (outputDir) {
          if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
          const payload = (await response.json()) as ExportWriteResponse
          setLastWrittenPath(payload.files[0]?.path ?? outputDir)
        } else {
          await downloadResponse(response, `${selectedCurve?.name ?? 'sea_level_curve'}.csv`)
        }
        return
      }

      if (!exportToZip && !outputDir) {
        for (const curve of curves) {
          // eslint-disable-next-line no-await-in-loop
          const response = await postSeaLevelExport({ scope: 'selected', curve_id: curve.id })
          // eslint-disable-next-line no-await-in-loop
          await downloadResponse(response, `${curve.name}.csv`)
        }
        return
      }

      const response = await postSeaLevelExport({
        scope: 'all',
        export_to_zip: exportToZip,
        output_dir: outputDir,
      })
      if (outputDir) {
        if (!response.ok) throw new Error(await readExportError(response, `Export failed (${response.status})`))
        const payload = (await response.json()) as ExportWriteResponse
        setLastWrittenPath(payload.files[0]?.path ?? outputDir)
      } else {
        await downloadResponse(response, 'sea_level_curves.zip')
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
        {scope === 'selected' ? (
          <label className="project-dialog__field">
            <span>Sea level curve</span>
            <select value={curveId ?? ''} onChange={(event) => setCurveId(event.target.value === '' ? null : Number(event.target.value))}>
              {curves.map((curve) => (
                <option key={curve.id} value={curve.id}>{curve.name}</option>
              ))}
            </select>
          </label>
        ) : (
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
        )}

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
        {!canSubmit ? <p className="project-dialog__error">No sea level curves are available for export.</p> : null}
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
