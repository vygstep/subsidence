import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardTargetWellFields,
  MappingPane,
  TabularPreviewPane,
  MAPPING_STEP_LABELS,
  buildImportWizardSteps,
  importWizardPresets,
  readImportError,
  useImportPreview,
} from './importWizard'
import {
  DEVIATION_FIELDS,
  autoMap,
  isMappingValid,
  validateDeviationMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

interface WellOption {
  well_id: string
  well_name: string
}

interface ImportDeviationDialogProps {
  wells: WellOption[]
  activeWellId?: string | null
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportDeviationResponse {
  well_id: string
}

export function ImportDeviationDialog({ wells, activeWellId, onClose, onSuccess }: ImportDeviationDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [wellId, setWellId] = useState(activeWellId ?? '')
  const [createNewWell, setCreateNewWell] = useState(false)
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.deviation
  const sourceIsValid = csvPath.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1

  const { isLoading: previewLoading, error: previewError, tabularPreview, parserSettings, updateParserSettings } = useImportPreview(
    'tabular',
    csvPath,
    isOnPreviewStep,
  )

  useEffect(() => {
    if (tabularPreview) {
      setMapping(autoMap(tabularPreview.columns, DEVIATION_FIELDS))
    }
  }, [tabularPreview])

  const previewReady = !previewLoading && tabularPreview !== null
  const mappingErrors = validateDeviationMapping(mapping)
  const mappingOk = isMappingValid(mappingErrors)

  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, MAPPING_STEP_LABELS)
  const validationMessages = currentStepIndex === 0 && !sourceIsValid ? ['CSV path is required.'] : []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = csvPath.trim()
    if (!nextPath) {
      setError('CSV path is required')
      return
    }

    const columnMap: Record<string, string> = {}
    for (const [fieldId, col] of Object.entries(mapping)) {
      if (col) columnMap[fieldId] = col
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation(preset.executeOperation, async () => {
        const response = await fetch(preset.executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            well_id: wellId || null,
            csv_path: nextPath,
            create_new_well: !wellId && createNewWell,
            column_map: Object.keys(columnMap).length > 0 ? columnMap : null,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Failed to import deviation (${response.status})`))
        }

        const payload = (await response.json()) as ImportDeviationResponse
        rememberImportPath(nextPath)
        await onSuccess(payload.well_id)
        onClose()
      }, {
        projectPath,
        activeWellId: wellId || activeWellId || null,
        details: { inputPath: nextPath, createNewWell },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import deviation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const picked = await pickFile(csvPath || lastImportRoot, preset.acceptedFileFilters)
      if (picked) setCsvPath(picked)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open file picker')
    }
  }

  const canAdvanceFromStep = (step: number): boolean => {
    if (step === 0) return sourceIsValid
    if (step === 1) return !previewLoading && (previewReady || previewError !== null)
    if (step === 2) return mappingOk
    return true
  }

  return (
    <ImportWizardShell
      preset={preset}
      titleId="import-deviation-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={canAdvanceFromStep(currentStepIndex)}
      canSubmit={sourceIsValid && mappingOk}
      validationMessages={validationMessages}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
    >
      {currentStepIndex === 0 ? (
        <label className="project-dialog__field">
          <span>Deviation CSV path</span>
          <div className="project-dialog__field-row">
            <input
              type="text"
              value={csvPath}
              onChange={(event) => setCsvPath(event.target.value)}
              placeholder="D:\\data\\deviation.csv"
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
      ) : null}

      {currentStepIndex === 1 ? (
        <TabularPreviewPane
          isLoading={previewLoading}
          error={previewError}
          preview={tabularPreview}
          settings={parserSettings}
          onSettingsChange={updateParserSettings}
        />
      ) : null}

      {currentStepIndex === 2 ? (
        <MappingPane
          columns={tabularPreview?.columns ?? []}
          fields={DEVIATION_FIELDS}
          mapping={mapping}
          validationErrors={mappingErrors}
          onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
        />
      ) : null}

      {currentStepIndex === 3 ? (
        <ImportWizardTargetWellFields
          wells={wells}
          wellId={wellId}
          createNewWell={createNewWell}
          emptyLabel="Reuse by file well_name / create from defaults"
          onWellIdChange={setWellId}
          onCreateNewWellChange={setCreateNewWell}
        />
      ) : null}

      {currentStepIndex === 4 ? (
        <div className="project-dialog__validation" aria-label="Import summary">
          <span>Source: {csvPath.trim()}</span>
          <span>Target: {wellId || 'file well_name / defaults'}</span>
        </div>
      ) : null}
    </ImportWizardShell>
  )
}
