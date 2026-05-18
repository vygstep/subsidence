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
  SEA_LEVEL_CURVE_FIELDS,
  autoMap,
  isMappingValid,
  preservedUnmappedColumnLabels,
  validateSeaLevelCurveMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']

interface LoadSeaLevelCurveDialogProps {
  onClose: () => void
  onSuccess: (pointCount: number) => void
}

function defaultCurveName(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  const filename = trimmed.split(/[\\/]/).filter(Boolean).pop() ?? trimmed
  return filename.replace(/\.[^.]+$/, '') || filename
}

export function LoadSeaLevelCurveDialog({ onClose, onSuccess }: LoadSeaLevelCurveDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [curveName, setCurveName] = useState('')
  const [curveNameEdited, setCurveNameEdited] = useState(false)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.seaLevelCurve
  const sourceIsValid = csvPath.trim().length > 0
  const curveNameIsValid = curveName.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1

  const { isLoading: previewLoading, error: previewError, tabularPreview, parserSettings, updateParserSettings } = useImportPreview(
    'tabular',
    csvPath,
    isOnPreviewStep,
  )

  useEffect(() => {
    if (!curveNameEdited) {
      setCurveName(defaultCurveName(csvPath))
    }
  }, [csvPath, curveNameEdited])

  useEffect(() => {
    if (tabularPreview) {
      setMapping(autoMap(tabularPreview.columns, SEA_LEVEL_CURVE_FIELDS))
    }
  }, [tabularPreview])

  const mappingErrors = validateSeaLevelCurveMapping(mapping)
  const mappingOk = isMappingValid(mappingErrors)
  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, STEP_LABELS)
  const validationMessages = [
    ...(currentStepIndex === 0 && !sourceIsValid ? ['CSV path is required.'] : []),
    ...(currentStepIndex === 1 && !curveNameIsValid ? ['Curve name is required.'] : []),
  ]

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = csvPath.trim()
    const nextName = curveName.trim()
    if (!nextPath) {
      setError('CSV path is required')
      return
    }
    if (!nextName) {
      setError('Curve name is required')
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
            curve_name: nextName,
            column_map: columnMap,
            delimiter: parserSettings.delimiter,
            header_row: parserSettings.headerRow,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Import failed (${response.status})`))
        }
        const payload = (await response.json()) as { curve_id: number; point_count: number }
        rememberImportPath(nextPath)
        onSuccess(payload.point_count)
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
      titleId="load-sea-level-curve-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={sourceIsValid}
      canSubmit={sourceIsValid && curveNameIsValid && mappingOk}
      validationMessages={validationMessages}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
      onBrowse={handleBrowse}
    >
      {currentStepIndex === 0 ? (
        <ImportWizardFileField
          label="Sea level CSV path"
          value={csvPath}
          placeholder="D:\\data\\sea_level.csv"
          onChange={setCsvPath}
        />
      ) : null}

      {currentStepIndex === 1 ? (
        <>
          <label className="project-dialog__field">
            <span>Curve name</span>
            <input
              value={curveName}
              onChange={(event) => {
                setCurveNameEdited(true)
                setCurveName(event.target.value)
              }}
            />
          </label>
          <TabularPreviewPane
            isLoading={previewLoading}
            error={previewError}
            preview={tabularPreview}
            settings={parserSettings}
            onSettingsChange={updateParserSettings}
            fields={SEA_LEVEL_CURVE_FIELDS}
            mapping={mapping}
            unmappedColumnLabels={preservedUnmappedColumnLabels(tabularPreview, mapping)}
            onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
          />
        </>
      ) : null}
    </ImportWizardShell>
  )
}
