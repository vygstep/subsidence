import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useNotificationStore, useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardFileField,
  ImportWizardShell,
  TabularPreviewPane,
  buildImportWizardSteps,
  importWizardPresets,
  readImportError,
  useImportPreview,
} from './importWizard'
import {
  WELLS_FIELDS,
  autoMap,
  isMappingValid,
  validateWellsMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']

interface ImportWellsDialogProps {
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportWellsResponse {
  well_id: string
  qc_warnings?: string[]
}

export function ImportWellsDialog({ onClose, onSuccess }: ImportWellsDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const addQcWarnings = useNotificationStore((state) => state.addQcWarnings)
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.wells
  const sourceIsValid = csvPath.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1

  const { isLoading: previewLoading, error: previewError, tabularPreview, parserSettings, updateParserSettings } = useImportPreview(
    'tabular',
    csvPath,
    isOnPreviewStep,
  )

  useEffect(() => {
    if (tabularPreview) {
      setMapping(autoMap(tabularPreview.columns, WELLS_FIELDS))
    }
  }, [tabularPreview])

  const mappingErrors = validateWellsMapping(mapping)
  const mappingOk = isMappingValid(mappingErrors)
  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, STEP_LABELS)
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
            csv_path: nextPath,
            column_map: Object.keys(columnMap).length > 0 ? columnMap : null,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Failed to import wells (${response.status})`))
        }

        const payload = (await response.json()) as ImportWellsResponse
        rememberImportPath(nextPath)
        const warnings = payload.qc_warnings ?? []
        await onSuccess(payload.well_id)
        onClose()
        if (warnings.length > 0) {
          addQcWarnings(warnings)
        }
      }, {
        projectPath,
        activeWellId: null,
        details: { inputPath: nextPath },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import wells')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const picked = await pickFile(csvPath || lastImportRoot, preset.acceptedFileFilters)
      if (picked) {
        setCsvPath(picked)
        setCurrentStepIndex(1)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open file picker')
    }
  }

  return (
    <ImportWizardShell
      preset={preset}
      titleId="import-wells-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={sourceIsValid}
      canSubmit={sourceIsValid && mappingOk}
      validationMessages={validationMessages}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
      onBrowse={handleBrowse}
    >
      {currentStepIndex === 0 ? (
        <ImportWizardFileField
          label="Wells CSV path"
          value={csvPath}
          placeholder="D:\\data\\wells.csv"
          onChange={setCsvPath}
        />
      ) : null}

      {currentStepIndex === 1 ? (
        <TabularPreviewPane
          isLoading={previewLoading}
          error={previewError}
          preview={tabularPreview}
          settings={parserSettings}
          onSettingsChange={updateParserSettings}
          fields={WELLS_FIELDS}
          mapping={mapping}
          onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
        />
      ) : null}
    </ImportWizardShell>
  )
}
