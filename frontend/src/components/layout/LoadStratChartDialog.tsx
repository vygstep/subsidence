import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
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
  STRAT_CHART_FIELDS,
  autoMap,
  isMappingValid,
  validateStratChartMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']

interface LoadStratChartDialogProps {
  onClose: () => void
  onSuccess: (unitsImported: number) => void
}

export function LoadStratChartDialog({ onClose, onSuccess }: LoadStratChartDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.stratChart
  const sourceIsValid = csvPath.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1

  const { isLoading: previewLoading, error: previewError, tabularPreview, parserSettings, updateParserSettings } = useImportPreview(
    'tabular',
    csvPath,
    isOnPreviewStep,
  )

  useEffect(() => {
    if (tabularPreview) {
      setMapping(autoMap(tabularPreview.columns, STRAT_CHART_FIELDS))
    }
  }, [tabularPreview])

  const mappingErrors = validateStratChartMapping(mapping)
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
            column_map: columnMap,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Import failed (${response.status})`))
        }
        const payload = (await response.json()) as { units_imported: number }
        rememberImportPath(nextPath)
        onSuccess(payload.units_imported)
        onClose()
      }, { projectPath, details: { inputPath: nextPath } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed')
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
      titleId="load-strat-chart-title"
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
          label="StratChart CSV path"
          value={csvPath}
          placeholder="D:\\data\\ics_chart2023.csv"
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
          fields={STRAT_CHART_FIELDS}
          mapping={mapping}
          onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
        />
      ) : null}
    </ImportWizardShell>
  )
}
