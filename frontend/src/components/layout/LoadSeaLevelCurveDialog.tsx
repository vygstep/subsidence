import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardFileField,
  ImportWizardShell,
  MultiFileCurrentFile,
  MultiFileSummary,
  TabularPreviewPane,
  buildImportWizardSteps,
  createMultiFileQueue,
  importWizardPresets,
  nextPendingFileIndex,
  readImportError,
  summarizeMultiFileQueue,
  useImportPreview,
} from './importWizard'
import type { MultiFileImportItem, MultiFileImportStatus } from './importWizard'
import {
  SEA_LEVEL_CURVE_FIELDS,
  autoMap,
  isMappingValid,
  preservedUnmappedColumnLabels,
  validateSeaLevelCurveMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFiles, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']
const SUMMARY_STEP_LABELS = ['File', 'Preview', 'Summary']

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
  const [fileQueue, setFileQueue] = useState<MultiFileImportItem[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.seaLevelCurve
  const sourceIsValid = csvPath.trim().length > 0
  const curveNameIsValid = curveName.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1
  const isSummaryStep = currentStepIndex === 2
  const isMultiFileRun = fileQueue.length > 1
  const currentFile = isMultiFileRun ? fileQueue[currentFileIndex] : null
  const queueSummary = summarizeMultiFileQueue(fileQueue)

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
  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, isSummaryStep ? SUMMARY_STEP_LABELS : STEP_LABELS)
  const validationMessages = [
    ...(currentStepIndex === 0 && !sourceIsValid ? ['CSV path is required.'] : []),
    ...(currentStepIndex === 1 && !curveNameIsValid ? ['Curve name is required.'] : []),
  ]

  const applyCsvPath = (
    nextPath: string,
    options: { nextStepIndex?: number; preserveQueue?: boolean } = {},
  ) => {
    setCsvPath(nextPath)
    setCurrentStepIndex(options.nextStepIndex ?? 0)
    setMapping({})
    setCurveNameEdited(false)
    setCurveName(defaultCurveName(nextPath))
    if (!options.preserveQueue) {
      setFileQueue([])
      setCurrentFileIndex(0)
    }
  }

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
        if (isMultiFileRun) {
          advanceMultiFileQueue('imported')
          return
        }
        onClose()
      }, { projectPath, details: { inputPath: nextPath } })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Import failed'
      if (isMultiFileRun) {
        advanceMultiFileQueue('failed', message)
      } else {
        setError(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const advanceMultiFileQueue = (status: MultiFileImportStatus, message?: string) => {
    setFileQueue((prev) => {
      const updated = prev.map((item, index) => (
        index === currentFileIndex ? { ...item, status, message } : item
      ))
      const nextIndex = nextPendingFileIndex(updated, currentFileIndex)
      if (nextIndex >= 0) {
        setCurrentFileIndex(nextIndex)
        applyCsvPath(updated[nextIndex].path, { nextStepIndex: 1, preserveQueue: true })
      } else {
        setCurrentStepIndex(2)
      }
      return updated
    })
  }

  const handleSkipCurrentFile = () => {
    if (!isMultiFileRun) return
    advanceMultiFileQueue('skipped', 'Skipped by user')
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const picked = await pickFiles(csvPath || lastImportRoot, preset.acceptedFileFilters)
      const queue = createMultiFileQueue(picked)
      if (queue.length > 0) {
        setFileQueue(queue.length > 1 ? queue : [])
        setCurrentFileIndex(0)
        applyCsvPath(queue[0].path, { nextStepIndex: 1, preserveQueue: queue.length > 1 })
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
      hidePrimaryAction={isSummaryStep}
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
          {isMultiFileRun ? (
            <MultiFileCurrentFile currentIndex={currentFileIndex} total={fileQueue.length} path={currentFile?.path ?? csvPath} />
          ) : null}
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
          {isMultiFileRun ? (
            <button type="button" className="project-dialog__button" onClick={handleSkipCurrentFile}>
              Skip this file
            </button>
          ) : null}
        </>
      ) : null}
      {isSummaryStep ? (
        <MultiFileSummary queue={fileQueue} summary={queueSummary} />
      ) : null}
    </ImportWizardShell>
  )
}
