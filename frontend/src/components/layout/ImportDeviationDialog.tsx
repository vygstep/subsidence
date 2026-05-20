import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useNotificationStore, useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardFileField,
  ImportWizardTargetWellSelect,
  IMPORT_WIZARD_CREATE_NEW_WELL,
  MultiFileCurrentFile,
  MultiFileSummary,
  TabularPreviewPane,
  buildImportWizardSteps,
  createMultiFileQueue,
  distinctMappedValues,
  importWizardPresets,
  nextPendingFileIndex,
  readImportError,
  summarizeMultiFileQueue,
  useImportPreview,
} from './importWizard'
import type { MultiFileImportItem, MultiFileImportStatus } from './importWizard'
import {
  DEVIATION_FIELDS,
  autoMap,
  isMappingValid,
  preservedUnmappedColumnLabels,
  validateDeviationMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFiles, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']
const SUMMARY_STEP_LABELS = ['File', 'Preview', 'Summary']

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
  qc_warnings?: string[]
}

export function ImportDeviationDialog({ wells, activeWellId, onClose, onSuccess }: ImportDeviationDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const addQcWarnings = useNotificationStore((state) => state.addQcWarnings)
  const [wellSelection, setWellSelection] = useState(activeWellId ?? '')
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [depthUnit, setDepthUnit] = useState<'m' | 'ft' | 'km'>('m')
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [fileQueue, setFileQueue] = useState<MultiFileImportItem[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.deviation
  const sourceIsValid = csvPath.trim().length > 0
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
    if (tabularPreview) {
      setMapping(autoMap(tabularPreview.columns, DEVIATION_FIELDS))
    }
  }, [tabularPreview])

  const mappingErrors = validateDeviationMapping(mapping)
  const mappingOk = isMappingValid(mappingErrors)
  const fileWellNames = distinctMappedValues(tabularPreview, mapping, 'well_name')
  const isMultiWell = fileWellNames.length > 1

  useEffect(() => {
    setWellSelection(fileWellNames.length > 0 ? '' : (activeWellId ?? ''))
  }, [activeWellId, fileWellNames.length])

  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, isSummaryStep ? SUMMARY_STEP_LABELS : STEP_LABELS)
  const validationMessages = currentStepIndex === 0 && !sourceIsValid ? ['CSV path is required.'] : []

  const resetPreviewState = () => {
    setMapping({})
    setWellSelection(activeWellId ?? '')
  }

  const applyCsvPath = (
    nextPath: string,
    options: { nextStepIndex?: number; preserveQueue?: boolean } = {},
  ) => {
    setCsvPath(nextPath)
    setCurrentStepIndex(options.nextStepIndex ?? 0)
    resetPreviewState()
    if (!options.preserveQueue) {
      setFileQueue([])
      setCurrentFileIndex(0)
    }
  }

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
    const createNewWell = wellSelection === IMPORT_WIZARD_CREATE_NEW_WELL
    const resolvedWellId = isMultiWell || createNewWell ? null : (wellSelection || null)

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation(preset.executeOperation, async () => {
        const response = await fetch(preset.executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            well_id: resolvedWellId,
            csv_path: nextPath,
            depth_unit: depthUnit,
            create_new_well: createNewWell,
            multi_well: isMultiWell,
            column_map: Object.keys(columnMap).length > 0 ? columnMap : null,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Failed to import deviation (${response.status})`))
        }

        const payload = (await response.json()) as ImportDeviationResponse
        rememberImportPath(nextPath)
        const warnings = payload.qc_warnings ?? []
        await onSuccess(payload.well_id)
        if (isMultiFileRun) {
          advanceMultiFileQueue('imported')
          return
        }
        onClose()
        if (warnings.length > 0) {
          addQcWarnings(warnings)
        }
      }, {
        projectPath,
        activeWellId: resolvedWellId || activeWellId || null,
        details: { inputPath: nextPath, depthUnit, createNewWell },
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to import deviation'
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
      titleId="import-deviation-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={sourceIsValid}
      canSubmit={sourceIsValid && mappingOk}
      validationMessages={validationMessages}
      hidePrimaryAction={isSummaryStep}
      terminalCloseOnly={isSummaryStep}
      beforeCancelAction={isMultiFileRun && !isSummaryStep ? {
        label: 'Skip this file',
        onClick: handleSkipCurrentFile,
      } : undefined}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
      onBrowse={handleBrowse}
    >
      {currentStepIndex === 0 ? (
        <ImportWizardFileField
          label="Deviation CSV path"
          value={csvPath}
          placeholder="D:\\data\\deviation.csv"
          onChange={setCsvPath}
        />
      ) : null}

      {currentStepIndex === 1 ? (
        <>
          {isMultiFileRun ? (
            <MultiFileCurrentFile currentIndex={currentFileIndex} total={fileQueue.length} path={currentFile?.path ?? csvPath} />
          ) : null}
          <TabularPreviewPane
            isLoading={previewLoading}
            error={previewError}
            preview={tabularPreview}
            settings={parserSettings}
            onSettingsChange={updateParserSettings}
            fields={DEVIATION_FIELDS}
            mapping={mapping}
            unmappedColumnLabels={preservedUnmappedColumnLabels(tabularPreview, mapping, { numericOnly: true })}
            onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
          />

          {!previewLoading && tabularPreview && (
            <div className="import-wizard__options">
              {isMultiWell ? (
                <p className="import-preview__status">Multi-well mode: {fileWellNames.length} wells detected.</p>
              ) : null}
              <div className="import-wizard__options-row">
                {!isMultiWell ? (
                  <ImportWizardTargetWellSelect
                    wells={wells}
                    value={wellSelection}
                    emptyLabel="Use file well_name / create from defaults"
                    onChange={setWellSelection}
                  />
                ) : null}
                <label className="project-dialog__field project-dialog__field--inline import-wizard__field">
                  <span>Depth unit</span>
                  <select value={depthUnit} onChange={(e) => setDepthUnit(e.target.value as 'm' | 'ft' | 'km')}>
                    <option value="m">m</option>
                    <option value="ft">ft</option>
                    <option value="km">km</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </>
      ) : null}
      {isSummaryStep ? (
        <MultiFileSummary queue={fileQueue} summary={queueSummary} />
      ) : null}
    </ImportWizardShell>
  )
}
