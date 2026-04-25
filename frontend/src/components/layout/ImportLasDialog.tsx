import { useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardTargetWellFields,
  LasPreviewPane,
  TabularPreviewPane,
  buildImportWizardSteps,
  importWizardPresets,
  readImportError,
  useImportPreview,
} from './importWizard'
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = sourceType === 'las' ? importWizardPresets.logsLas : importWizardPresets.logsCsv
  const sourceIsValid = sourcePath.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1

  const { isLoading: previewLoading, error: previewError, tabularPreview, lasPreview, parserSettings, updateParserSettings } = useImportPreview(
    preset.previewMode,
    sourcePath,
    isOnPreviewStep,
  )

  const previewReady = previewLoading
    ? false
    : preset.previewMode === 'las'
      ? lasPreview !== null
      : tabularPreview !== null

  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid)
  const validationMessages = currentStepIndex === 0 && !sourceIsValid
    ? [`${sourceType === 'las' ? 'LAS' : 'CSV'} path is required.`]
    : []

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

  const canAdvanceFromStep = (step: number): boolean => {
    if (step === 0) return sourceIsValid
    if (step === 1) return !previewLoading && (previewReady || previewError !== null)
    return true
  }

  return (
    <ImportWizardShell
      preset={preset}
      titleId="import-las-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={canAdvanceFromStep(currentStepIndex)}
      canSubmit={sourceIsValid}
      validationMessages={validationMessages}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
    >
      {currentStepIndex === 0 ? (
        <>
          <label className="project-dialog__field">
            <span>Format</span>
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value as LogSourceType)}>
              <option value="las">LAS</option>
              <option value="csv">CSV</option>
            </select>
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
        </>
      ) : null}

      {currentStepIndex === 1 ? (
        sourceType === 'las' ? (
          <LasPreviewPane isLoading={previewLoading} error={previewError} preview={lasPreview} />
        ) : (
          <TabularPreviewPane
            isLoading={previewLoading}
            error={previewError}
            preview={tabularPreview}
            settings={parserSettings}
            onSettingsChange={updateParserSettings}
          />
        )
      ) : null}

      {currentStepIndex === 2 ? (
        <>
          <ImportWizardTargetWellFields
            wells={wells}
            wellId={wellId}
            createNewWell={createNewWell}
            emptyLabel={sourceType === 'las' ? 'Reuse by LAS header / create from defaults' : 'Reuse by CSV well_name / create from defaults'}
            onWellIdChange={setWellId}
            onCreateNewWellChange={setCreateNewWell}
          />
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
        </>
      ) : null}

      {currentStepIndex === 3 ? (
        <div className="project-dialog__validation" aria-label="Import summary">
          <span>Source: {sourcePath.trim()}</span>
          <span>Target: {wellId || 'file header / defaults'}</span>
        </div>
      ) : null}
    </ImportWizardShell>
  )
}
