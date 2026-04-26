import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardTargetWellFields,
  LasPreviewPane,
  MappingPane,
  TabularPreviewPane,
  DEFAULT_STEP_LABELS,
  MAPPING_STEP_LABELS,
  buildImportWizardSteps,
  importWizardPresets,
  readImportError,
  useImportPreview,
} from './importWizard'
import {
  LOGS_CSV_FIELDS,
  autoMap,
  isMappingValid,
  validateLogsCsvMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
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
  const [wellPolicy, setWellPolicy] = useState<'file' | 'override'>('override')
  const [sourceType, setSourceType] = useState<LogSourceType>('las')
  const [sourcePath, setSourcePath] = useState(() => getLastImportRoot())
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [trustedDepthRef, setTrustedDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qcWarnings, setQcWarnings] = useState<string[]>([])
  const lastImportRoot = getLastImportRoot()
  const preset = sourceType === 'las' ? importWizardPresets.logsLas : importWizardPresets.logsCsv
  const sourceIsValid = sourcePath.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1
  const stepLabels = sourceType === 'csv' ? MAPPING_STEP_LABELS : DEFAULT_STEP_LABELS

  const { isLoading: previewLoading, error: previewError, tabularPreview, lasPreview, parserSettings, updateParserSettings } = useImportPreview(
    preset.previewMode,
    sourcePath,
    isOnPreviewStep,
  )

  useEffect(() => {
    if (tabularPreview && sourceType === 'csv') {
      setMapping(autoMap(tabularPreview.columns, LOGS_CSV_FIELDS))
    }
  }, [tabularPreview, sourceType])

  // LAS files carry a well name in their header; use it as the file well source.
  const fileWellSource = sourceType === 'las' ? (lasPreview?.well_name ?? null) : null

  useEffect(() => {
    setWellPolicy(fileWellSource ? 'file' : 'override')
  }, [fileWellSource])

  const handleSourceTypeChange = (next: LogSourceType) => {
    setSourceType(next)
    setCurrentStepIndex(0)
    setMapping({})
  }

  const previewReady = previewLoading
    ? false
    : preset.previewMode === 'las'
      ? lasPreview !== null
      : tabularPreview !== null

  const mappingErrors = sourceType === 'csv' ? validateLogsCsvMapping(mapping) : []
  const mappingOk = isMappingValid(mappingErrors)

  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, stepLabels)
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

    const columnMap: Record<string, string> = {}
    for (const [fieldId, col] of Object.entries(mapping)) {
      if (col) columnMap[fieldId] = col
    }

    const useFileWell = sourceType === 'las' && wellPolicy === 'file'

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
                  well_id: useFileWell ? null : (wellId || null),
                  create_new_well: useFileWell ? false : (!wellId && createNewWell),
                  trusted_depth_reference: trustedDepthRef,
                }
              : {
                  csv_path: nextPath,
                  well_id: wellId || null,
                  depth_column: columnMap['depth'] ?? null,
                  create_new_well: !wellId && createNewWell,
                  trusted_depth_reference: trustedDepthRef,
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

        const payload = (await response.json()) as ImportLasResponse & { qc_warnings?: string[]; well_id: string }
        rememberImportPath(nextPath)
        const warnings = payload.qc_warnings ?? []
        setQcWarnings(warnings)
        await onSuccess(payload.well_id)
        if (warnings.length === 0) {
          onClose()
        }
      }, {
        projectPath,
        activeWellId: useFileWell ? null : (wellId || activeWellId || null),
        details: { inputPath: nextPath, createNewWell, depthColumn: columnMap['depth'] ?? null },
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
      if (picked) setSourcePath(picked)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open file picker')
    }
  }

  // For CSV: steps are File(0) Preview(1) Mapping(2) Options(3) Import(4)
  // For LAS: steps are File(0) Preview(1) Options(2) Import(3)
  const optionsStep = sourceType === 'csv' ? 3 : 2
  const summaryStep = sourceType === 'csv' ? 4 : 3

  const canAdvanceFromStep = (step: number): boolean => {
    if (step === 0) return sourceIsValid
    if (step === 1) return !previewLoading && (previewReady || previewError !== null)
    if (step === 2 && sourceType === 'csv') return mappingOk
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
      canSubmit={sourceIsValid && (sourceType === 'las' || mappingOk)}
      validationMessages={validationMessages}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
    >
      {currentStepIndex === 0 ? (
        <>
          <label className="project-dialog__field">
            <span>Format</span>
            <select value={sourceType} onChange={(event) => handleSourceTypeChange(event.target.value as LogSourceType)}>
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

      {currentStepIndex === 2 && sourceType === 'csv' ? (
        <MappingPane
          columns={tabularPreview?.columns ?? []}
          fields={LOGS_CSV_FIELDS}
          mapping={mapping}
          validationErrors={mappingErrors}
          onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
        />
      ) : null}

      {currentStepIndex === optionsStep ? (
        <>
          <ImportWizardTargetWellFields
            wells={wells}
            wellId={wellId}
            createNewWell={createNewWell}
            emptyLabel={sourceType === 'las' ? 'Create or match by LAS well name' : 'Create or match by CSV well_name'}
            fileWellSource={fileWellSource}
            wellPolicy={wellPolicy}
            onWellIdChange={setWellId}
            onCreateNewWellChange={setCreateNewWell}
            onWellPolicyChange={setWellPolicy}
          />
          <label className="project-dialog__field">
            <span>Depth reference</span>
            <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
              <option value="MD">MD — measured depth (default)</option>
              <option value="TVD">TVD — true vertical depth</option>
              <option value="TVDSS">TVDSS — TVD subsea (KB-referenced)</option>
            </select>
          </label>
        </>
      ) : null}

      {currentStepIndex === summaryStep ? (
        <div className="project-dialog__validation" aria-label="Import summary">
          <span>Source: {sourcePath.trim()}</span>
          <span>Target: {
            sourceType === 'las' && wellPolicy === 'file'
              ? `LAS well name: ${fileWellSource}`
              : (wellId || 'new well')
          }</span>
        </div>
      ) : null}

      {qcWarnings.length > 0 ? (
        <div className="import-qc-warnings">
          <div className="import-qc-warnings__header">
            Import completed with {qcWarnings.length} QC warning{qcWarnings.length > 1 ? 's' : ''}:
          </div>
          <ul className="import-qc-warnings__list">
            {qcWarnings.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
          <button type="button" className="project-dialog__close" onClick={onClose}>
            Dismiss and close
          </button>
        </div>
      ) : null}
    </ImportWizardShell>
  )
}
