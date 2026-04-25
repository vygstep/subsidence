import { useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import { ImportWizardShell, importWizardPresets, readImportError } from './importWizard'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

interface WellOption {
  well_id: string
  well_name: string
}

interface ImportLasDialogProps {
  wells: WellOption[]
  activeWellId?: string | null
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportLasResponse {
  well_id: string
}

type LogSourceType = 'las' | 'csv'

export function ImportLasDialog({ wells, activeWellId, onClose, onSuccess }: ImportLasDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [wellId, setWellId] = useState(activeWellId ?? '')
  const [createNewWell, setCreateNewWell] = useState(false)
  const [sourceType, setSourceType] = useState<LogSourceType>('las')
  const [sourcePath, setSourcePath] = useState(() => getLastImportRoot())
  const [depthColumn, setDepthColumn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = sourceType === 'las' ? importWizardPresets.logsLas : importWizardPresets.logsCsv

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = sourcePath.trim()
    if (!nextPath) {
      setError(sourceType === 'las' ? 'LAS path is required' : 'CSV path is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation(preset.executeOperation, async () => {
        const response = await fetch(preset.executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            sourceType === 'las'
              ? {
                  las_path: nextPath,
                  well_id: wellId || null,
                  create_new_well: !wellId && createNewWell,
                }
              : {
                  csv_path: nextPath,
                  well_id: wellId || null,
                  depth_column: depthColumn.trim() || null,
                  create_new_well: !wellId && createNewWell,
                },
          ),
        })
        if (!response.ok) {
          throw new Error(await readImportError(
            response,
            sourceType === 'las'
              ? `Failed to import LAS (${response.status})`
              : `Failed to import CSV logs (${response.status})`,
          ))
        }

        const payload = (await response.json()) as ImportLasResponse
        rememberImportPath(nextPath)
        await onSuccess(payload.well_id)
        onClose()
      }, {
        projectPath,
        activeWellId: wellId || activeWellId || null,
        details: { inputPath: nextPath, createNewWell, depthColumn: depthColumn.trim() || null },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import logs')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const picked = await pickFile(sourcePath || lastImportRoot, preset.acceptedFileFilters)
      if (picked) {
        setSourcePath(picked)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open file picker')
    }
  }

  return (
    <ImportWizardShell
      preset={preset}
      titleId="import-las-title"
      error={error}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
        <label className="project-dialog__field">
          <span>Format</span>
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value as LogSourceType)}>
            <option value="las">LAS</option>
            <option value="csv">CSV</option>
          </select>
        </label>

        <label className="project-dialog__field">
          <span>Target well</span>
          <select value={wellId} onChange={(event) => setWellId(event.target.value)}>
            <option value="">
              {sourceType === 'las' ? 'Reuse by LAS header / create from defaults' : 'Reuse by CSV well_name / create from defaults'}
            </option>
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
          <span>{sourceType === 'las' ? 'LAS file path' : 'CSV file path'}</span>
          <div className="project-dialog__field-row">
            <input
              type="text"
              value={sourcePath}
              onChange={(event) => setSourcePath(event.target.value)}
              placeholder={sourceType === 'las' ? 'D:\\data\\well.las' : 'D:\\data\\well_logs.csv'}
              autoFocus
            />
            <div className="project-dialog__path-actions">
              <button type="button" className="project-dialog__path-action" disabled={!lastImportRoot} onClick={() => setSourcePath(lastImportRoot)}>
                Use last folder
              </button>
              <button type="button" className="project-dialog__path-action" onClick={() => void handleBrowse()}>
                Browse...
              </button>
            </div>
          </div>
        </label>

        {sourceType === 'csv' ? (
          <label className="project-dialog__field">
            <span>Depth column</span>
            <input
              type="text"
              value={depthColumn}
              onChange={(event) => setDepthColumn(event.target.value)}
              placeholder="Optional: DEPT / DEPTH / MD"
            />
          </label>
        ) : null}
    </ImportWizardShell>
  )
}
