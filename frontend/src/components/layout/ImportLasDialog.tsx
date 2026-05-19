import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useNotificationStore, useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'
import { detectCsvLogCurveType } from '@/utils/curveTypeDetection'

import {
  ImportWizardShell,
  ImportWizardFileField,
  ImportWizardTargetWellSelect,
  IMPORT_WIZARD_CREATE_NEW_WELL,
  LasPreviewPane,
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
  LOGS_CSV_FIELDS,
  autoMap,
  validateLogsCsvMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFiles, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']
const SUMMARY_STEP_LABELS = ['File', 'Preview', 'Summary']

// Sentinel values for the target well dropdown
const CREATE_FROM_FILE = '__create_from_file__'

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

const LOG_FILE_FILTERS: [string, string][] = [
  ['Log files', '*.las *.csv *.tsv *.txt'],
  ['LAS files', '*.las'],
  ['Delimited text', '*.csv *.tsv *.txt'],
  ['All files', '*.*'],
]

function normalizeLasDepthUnit(unit: string | null): 'm' | 'ft' | 'km' {
  if (!unit) return 'm'
  const u = unit.toLowerCase().trim()
  if (u === 'ft' || u === 'feet' || u === 'f') return 'ft'
  if (u === 'km') return 'km'
  return 'm'
}

function detectLasDepthRef(mnemonic: string): 'MD' | 'TVD' | 'TVDSS' {
  const m = mnemonic.toUpperCase().trim()
  if (m.startsWith('TVDSS')) return 'TVDSS'
  if (m.startsWith('TVD')) return 'TVD'
  return 'MD'
}

function detectCsvDepthRef(columnName: string): 'MD' | 'TVD' | 'TVDSS' {
  const c = columnName.toLowerCase().replace(/[_\s-]/g, '')
  if (c.includes('tvdss')) return 'TVDSS'
  if (c.includes('tvd')) return 'TVD'
  return 'MD'
}

function displayCurveMnemonic(columnName: string): string {
  const bracketMatch = columnName.match(/^(.+?)\s*\[[^\]]+\]\s*$/)
  if (bracketMatch) return bracketMatch[1].trim() || columnName
  const parenMatch = columnName.match(/^(.+?)\s*\([^)]+\)\s*$/)
  if (parenMatch) return parenMatch[1].trim() || columnName
  return columnName.trim() || columnName
}

function detectLogSourceType(path: string): LogSourceType | null {
  const extension = path.trim().split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase()
  if (!extension) return null
  if (extension === 'las') return 'las'
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') return 'csv'
  return null
}

function hasFileExtension(path: string): boolean {
  return /\.[^\\/.\s]+$/.test(path.trim())
}

export function ImportLasDialog({ wells, activeWellId, onClose, onSuccess }: ImportLasDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const addQcWarnings = useNotificationStore((state) => state.addQcWarnings)
  // Single selection value: well_id | CREATE_FROM_FILE | IMPORT_WIZARD_CREATE_NEW_WELL | ''
  const [wellSelection, setWellSelection] = useState(activeWellId ?? '')
  const [sourceType, setSourceType] = useState<LogSourceType>('las')
  const [sourcePath, setSourcePath] = useState(() => getLastImportRoot())
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [trustedDepthRef, setTrustedDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [depthUnit, setDepthUnit] = useState<'m' | 'ft' | 'km'>('m')
  const [nullValue, setNullValue] = useState('-999.25')
  const [curveTypes, setCurveTypes] = useState<Record<string, 'continuous' | 'discrete'>>({})
  const [manualCurveTypeColumns, setManualCurveTypeColumns] = useState<Set<string>>(() => new Set())
  const [fileQueue, setFileQueue] = useState<MultiFileImportItem[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = sourceType === 'las' ? importWizardPresets.logsLas : importWizardPresets.logsCsv
  const sourceIsValid = sourcePath.trim().length > 0
  const detectedSourceType = detectLogSourceType(sourcePath)
  const sourceTypeError = sourceIsValid && hasFileExtension(sourcePath) && detectedSourceType === null
    ? 'Unsupported log file type. Select a LAS, CSV, TSV, or TXT file.'
    : null
  const isOnPreviewStep = currentStepIndex === 1
  const isSummaryStep = currentStepIndex === 2
  const isMultiFileRun = fileQueue.length > 1
  const currentFile = isMultiFileRun ? fileQueue[currentFileIndex] : null
  const queueSummary = summarizeMultiFileQueue(fileQueue)
  const logsCsvFields = useMemo(
    () => LOGS_CSV_FIELDS.map((field) => (
      field.id === 'depth' ? { ...field, label: trustedDepthRef } : field
    )),
    [trustedDepthRef],
  )

  const { isLoading: previewLoading, error: previewError, tabularPreview, lasPreview, parserSettings, updateParserSettings } = useImportPreview(
    preset.previewMode,
    sourcePath,
    isOnPreviewStep,
  )

  // Auto-map CSV columns on preview load
  useEffect(() => {
    if (tabularPreview && sourceType === 'csv') {
      setMapping(autoMap(tabularPreview.columns, LOGS_CSV_FIELDS))
    }
  }, [tabularPreview, sourceType])

  // Auto-detect LAS depth ref from depth curve mnemonic
  useEffect(() => {
    if (lasPreview?.curves.length) {
      setTrustedDepthRef(detectLasDepthRef(lasPreview.curves[0].mnemonic))
    }
  }, [lasPreview])

  // Auto-detect depth unit from LAS file header
  useEffect(() => {
    if (sourceType === 'las' && lasPreview?.depth_unit) {
      setDepthUnit(normalizeLasDepthUnit(lasPreview.depth_unit))
    }
  }, [lasPreview, sourceType])

  useEffect(() => {
    if (sourceType === 'las' && lasPreview?.null_value !== null && lasPreview?.null_value !== undefined) {
      setNullValue(String(lasPreview.null_value))
    }
  }, [lasPreview, sourceType])

  // Auto-detect CSV depth ref from depth column name
  useEffect(() => {
    const col = mapping['depth']
    if (col) setTrustedDepthRef(detectCsvDepthRef(col))
  }, [mapping])

  // Auto-select target well from LAS well name
  useEffect(() => {
    if (sourceType !== 'las') return
    if (!lasPreview) return
    if (!lasPreview.well_name) {
      // No well name in file — prefer active well
      setWellSelection(activeWellId ?? '')
      return
    }
    const normalized = lasPreview.well_name.trim().toLowerCase()
    const match = wells.find((w) => w.well_name.trim().toLowerCase() === normalized)
    setWellSelection(match ? match.well_id : CREATE_FROM_FILE)
  }, [lasPreview, wells, activeWellId, sourceType])

  // Auto-detect curve types for LAS (default continuous; no sample values in preview)
  useEffect(() => {
    if (!lasPreview) return
    setCurveTypes((prev) => {
      const detected: Record<string, 'continuous' | 'discrete'> = {}
      for (let i = 1; i < lasPreview.curves.length; i++) {
        const mnemonic = lasPreview.curves[i].mnemonic
        detected[mnemonic] = manualCurveTypeColumns.has(mnemonic) && prev[mnemonic]
          ? prev[mnemonic]
          : 'continuous'
      }
      return detected
    })
  }, [lasPreview, manualCurveTypeColumns])

  // Auto-detect curve types for CSV columns from preview rows
  useEffect(() => {
    if (!tabularPreview || sourceType !== 'csv') return
    const depthCol = mapping['depth']
    const wellNameCol = mapping['well_name']
    setCurveTypes((prev) => {
      const detected: Record<string, 'continuous' | 'discrete'> = {}
      tabularPreview.columns.forEach((col, idx) => {
        if (col === depthCol) return
        if (col === wellNameCol) return
        detected[col] = manualCurveTypeColumns.has(col) && prev[col]
          ? prev[col]
          : detectCsvLogCurveType(col, idx, tabularPreview.rows)
      })
      return detected
    })
  }, [manualCurveTypeColumns, mapping, sourceType, tabularPreview])

  const lasWellName = lasPreview?.well_name ?? null

  const resetPreviewState = () => {
    setMapping({})
    setCurveTypes({})
    setManualCurveTypeColumns(new Set())
    setWellSelection(activeWellId ?? '')
  }

  const applySourcePath = (
    nextPath: string,
    options: { nextStepIndex?: number; preserveQueue?: boolean } = {},
  ) => {
    const nextSourceType = detectLogSourceType(nextPath)
    if (nextSourceType && nextSourceType !== sourceType) {
      setSourceType(nextSourceType)
    }
    setCurrentStepIndex(options.nextStepIndex ?? 0)
    resetPreviewState()
    if (!options.preserveQueue) {
      setFileQueue([])
      setCurrentFileIndex(0)
    }
    setSourcePath(nextPath)
  }

  const handleCurveTypeChange = (column: string, type: 'continuous' | 'discrete') => {
    setManualCurveTypeColumns((prev) => new Set(prev).add(column))
    setCurveTypes((prev) => ({ ...prev, [column]: type }))
  }

  useEffect(() => {
    setManualCurveTypeColumns(new Set())
  }, [sourcePath, sourceType])

  const previewReady = previewLoading
    ? false
    : preset.previewMode === 'las'
      ? lasPreview !== null
      : tabularPreview !== null
  const hasImportableLogCurves = Object.keys(curveTypes).length > 0

  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, isSummaryStep ? SUMMARY_STEP_LABELS : STEP_LABELS)
  const validationMessages = currentStepIndex === 0 && !sourceIsValid
    ? [`${sourceType === 'las' ? 'LAS' : 'CSV'} path is required.`]
    : sourceTypeError
      ? [sourceTypeError]
    : []

  const canSubmit = sourceType === 'las'
    ? sourceIsValid && sourceTypeError === null && previewReady && hasImportableLogCurves
    : sourceIsValid && sourceTypeError === null && tabularPreview !== null && validateLogsCsvMapping(mapping).length === 0 && hasImportableLogCurves
  const csvWellNames = sourceType === 'csv' ? distinctMappedValues(tabularPreview, mapping, 'well_name') : []
  const isCsvMultiWell = csvWellNames.length > 1
  const csvCurveColumnLabels = useMemo(() => {
    if (!tabularPreview || sourceType !== 'csv') return {}
    const depthCol = mapping['depth']
    const wellNameCol = mapping['well_name']
    return Object.fromEntries(
      tabularPreview.columns
        .filter((col) => col !== depthCol && col !== wellNameCol)
        .map((col) => [col, displayCurveMnemonic(col)]),
    )
  }, [mapping, sourceType, tabularPreview])

  useEffect(() => {
    if (sourceType !== 'csv') return
    setWellSelection(csvWellNames.length > 0 ? '' : (activeWellId ?? ''))
  }, [activeWellId, csvWellNames.length, sourceType])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = sourcePath.trim()
    if (!nextPath) {
      setError(sourceType === 'las' ? 'LAS path is required' : 'CSV path is required')
      return
    }
    if (sourceTypeError) {
      setError(sourceTypeError)
      return
    }

    // Resolve selection to API params
    const isCreateFromFile = wellSelection === CREATE_FROM_FILE
    const isCreateNew = wellSelection === IMPORT_WIZARD_CREATE_NEW_WELL
    const resolvedWellId = (!isCreateFromFile && !isCreateNew && wellSelection) ? wellSelection : null
    const createNewWell = isCreateNew
    const parsedNullValue = Number.parseFloat(nullValue)
    if (!Number.isFinite(parsedNullValue)) {
      setError('Null value must be a finite number.')
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
                  well_id: resolvedWellId,
                  create_new_well: createNewWell,
                  trusted_depth_reference: trustedDepthRef,
                  depth_unit: depthUnit,
                  curve_types: curveTypes,
                  null_value: parsedNullValue,
                }
              : {
                  csv_path: nextPath,
                  well_id: isCsvMultiWell ? null : resolvedWellId,
                  depth_column: mapping['depth'] ?? null,
                  create_new_well: createNewWell,
                  multi_well: isCsvMultiWell,
                  trusted_depth_reference: trustedDepthRef,
                  depth_unit: depthUnit,
                  curve_types: curveTypes,
                  null_value: parsedNullValue,
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
        await onSuccess(payload.well_id)
        if (warnings.length > 0) {
          addQcWarnings(warnings)
        }
        if (isMultiFileRun) {
          advanceMultiFileQueue('imported')
          return
        }
        onClose()
      }, {
        projectPath,
        activeWellId: resolvedWellId ?? activeWellId ?? null,
        details: { inputPath: nextPath, createNewWell, depthColumn: mapping['depth'] ?? null },
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to import logs'
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
        applySourcePath(updated[nextIndex].path, { nextStepIndex: 1, preserveQueue: true })
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
      const picked = await pickFiles(sourcePath || lastImportRoot, LOG_FILE_FILTERS)
      const queue = createMultiFileQueue(picked)
      if (queue.length > 0) {
        setFileQueue(queue.length > 1 ? queue : [])
        setCurrentFileIndex(0)
        applySourcePath(queue[0].path, { nextStepIndex: 1, preserveQueue: queue.length > 1 })
        setCurrentStepIndex(1)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open file picker')
    }
  }

  return (
    <ImportWizardShell
      preset={preset}
      titleId="import-las-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={sourceIsValid}
      canSubmit={canSubmit}
      validationMessages={validationMessages}
      hidePrimaryAction={isSummaryStep}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
      onBrowse={handleBrowse}
    >
      {currentStepIndex === 0 ? (
        <ImportWizardFileField
          label="Log file path"
          value={sourcePath}
          placeholder="D:\\data\\well.las or D:\\data\\well_logs.csv"
          onChange={applySourcePath}
        />
      ) : null}

      {currentStepIndex === 1 ? (
        sourceType === 'las' ? (
          <>
            {isMultiFileRun ? (
              <div className="import-preview__status">
                File {currentFileIndex + 1} of {fileQueue.length}: {currentFile?.path ?? sourcePath}
              </div>
            ) : null}
            <LasPreviewPane
              isLoading={previewLoading}
              error={previewError}
              preview={lasPreview}
              curveTypes={curveTypes}
              onCurveTypeChange={handleCurveTypeChange}
            />
            {!previewLoading && (lasPreview !== null || previewError !== null) && (
              <div className="import-wizard__options">
                <div className="import-wizard__options-row">
                  <ImportWizardTargetWellSelect
                    value={wellSelection}
                    wells={wells}
                    onChange={setWellSelection}
                    emptyLabel="Use file well name / create from defaults"
                    extraOptions={lasWellName ? [{ value: CREATE_FROM_FILE, label: `Create new well "${lasWellName}"` }] : []}
                  />
                  <label className="project-dialog__field project-dialog__field--inline import-wizard__field">
                    <span>Depth unit</span>
                    <select value={depthUnit} onChange={(e) => setDepthUnit(e.target.value as 'm' | 'ft' | 'km')}>
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                      <option value="km">km</option>
                    </select>
                  </label>
                  <label className="project-dialog__field project-dialog__field--inline import-wizard__field">
                    <span>Null value</span>
                    <input
                      type="number"
                      step="any"
                      value={nullValue}
                      onChange={(e) => setNullValue(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
            {!previewLoading && lasPreview !== null && !hasImportableLogCurves && (
              <p className="project-dialog__error">No importable log curves were found in selected file.</p>
            )}
            {isMultiFileRun ? (
              <button type="button" className="project-dialog__button" onClick={handleSkipCurrentFile}>
                Skip this file
              </button>
            ) : null}
          </>
        ) : (
          <>
            {isMultiFileRun ? (
              <div className="import-preview__status">
                File {currentFileIndex + 1} of {fileQueue.length}: {currentFile?.path ?? sourcePath}
              </div>
            ) : null}
            <TabularPreviewPane
              isLoading={previewLoading}
              error={previewError}
              preview={tabularPreview}
              settings={parserSettings}
              onSettingsChange={updateParserSettings}
              depthColumn={mapping['depth'] ?? null}
              fields={logsCsvFields}
              mapping={mapping}
              onMappingChange={(fieldId, colName) => setMapping((prev) => ({ ...prev, [fieldId]: colName }))}
              unmappedColumnLabels={csvCurveColumnLabels}
              curveTypes={curveTypes}
              onCurveTypeChange={handleCurveTypeChange}
              curveTypeExcludedColumns={[mapping['well_name']].filter(Boolean) as string[]}
            />
            {!previewLoading && tabularPreview && (
              <div className="import-wizard__options">
                {isCsvMultiWell ? (
                  <p className="import-preview__status">Multi-well mode: {csvWellNames.length} wells detected.</p>
                ) : null}
                <div className="import-wizard__options-row">
                  {!isCsvMultiWell ? (
                    <ImportWizardTargetWellSelect
                      value={wellSelection}
                      wells={wells}
                      onChange={setWellSelection}
                      emptyLabel="Use file well_name / create from defaults"
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
                  <label className="project-dialog__field project-dialog__field--inline import-wizard__field">
                    <span>Null value</span>
                    <input
                      type="number"
                      step="any"
                      value={nullValue}
                      onChange={(e) => setNullValue(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
            {!previewLoading && tabularPreview && !mapping['depth'] && (
              <p className="project-dialog__error">
                No depth column detected. Rename a column to DEPT, DEPTH, MD, TVD, or TVDSS and reload.
              </p>
            )}
            {!previewLoading && tabularPreview && mapping['depth'] && !hasImportableLogCurves && (
              <p className="project-dialog__error">No importable log curves were found in selected file.</p>
            )}
            {isMultiFileRun ? (
              <button type="button" className="project-dialog__button" onClick={handleSkipCurrentFile}>
                Skip this file
              </button>
            ) : null}
          </>
        )
      ) : null}

      {isSummaryStep ? (
        <div className="import-preview">
          <p className="import-preview__status">
            Imported {queueSummary.imported} of {queueSummary.total} files.
            {queueSummary.failed > 0 ? ` Failed: ${queueSummary.failed}.` : ''}
            {queueSummary.skipped > 0 ? ` Skipped: ${queueSummary.skipped}.` : ''}
          </p>
          <div className="import-preview__table-wrap">
            <table className="import-preview__table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {fileQueue.map((item) => (
                  <tr key={item.path}>
                    <td>{item.path}</td>
                    <td>{item.status}</td>
                    <td>{item.message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

    </ImportWizardShell>
  )
}
