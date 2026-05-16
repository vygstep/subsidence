import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useNotificationStore, useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardFileField,
  ImportWizardTargetWellSelect,
  IMPORT_WIZARD_CREATE_NEW_WELL,
  LasPreviewPane,
  TabularPreviewPane,
  buildImportWizardSteps,
  distinctMappedValues,
  importWizardPresets,
  readImportError,
  useImportPreview,
} from './importWizard'
import {
  LOGS_CSV_FIELDS,
  autoMap,
  validateLogsCsvMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

const STEP_LABELS = ['File', 'Preview']

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

function detectColumnCurveType(colIndex: number, rows: string[][]): 'continuous' | 'discrete' {
  const vals = rows.map((r) => r[colIndex]).filter((v) => v !== '' && v !== null && v !== undefined)
  if (vals.length === 0) return 'continuous'
  if (vals.every((v) => /^-?\d+$/.test(v.trim()))) return 'discrete'
  return 'continuous'
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
    const detected: Record<string, 'continuous' | 'discrete'> = {}
    for (let i = 1; i < lasPreview.curves.length; i++) {
      detected[lasPreview.curves[i].mnemonic] = 'continuous'
    }
    setCurveTypes(detected)
  }, [lasPreview])

  // Auto-detect curve types for CSV columns from preview rows
  useEffect(() => {
    if (!tabularPreview || sourceType !== 'csv') return
    const depthCol = mapping['depth']
    const wellNameCol = mapping['well_name']
    const detected: Record<string, 'continuous' | 'discrete'> = {}
    tabularPreview.columns.forEach((col, idx) => {
      if (col === depthCol) return
      if (col === wellNameCol) return
      detected[col] = detectColumnCurveType(idx, tabularPreview.rows)
    })
    setCurveTypes(detected)
  }, [tabularPreview, mapping, sourceType])

  const lasWellName = lasPreview?.well_name ?? null

  const handleSourceTypeChange = (next: LogSourceType) => {
    setSourceType(next)
    setCurrentStepIndex(0)
    setMapping({})
    setCurveTypes({})
    setWellSelection(activeWellId ?? '')
  }

  const previewReady = previewLoading
    ? false
    : preset.previewMode === 'las'
      ? lasPreview !== null
      : tabularPreview !== null
  const hasImportableLogCurves = Object.keys(curveTypes).length > 0

  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid, STEP_LABELS)
  const validationMessages = currentStepIndex === 0 && !sourceIsValid
    ? [`${sourceType === 'las' ? 'LAS' : 'CSV'} path is required.`]
    : []

  const canSubmit = sourceType === 'las'
    ? sourceIsValid && previewReady && hasImportableLogCurves
    : sourceIsValid && tabularPreview !== null && validateLogsCsvMapping(mapping).length === 0 && hasImportableLogCurves
  const csvWellNames = sourceType === 'csv' ? distinctMappedValues(tabularPreview, mapping, 'well_name') : []
  const isCsvMultiWell = csvWellNames.length > 1

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
        onClose()
        if (warnings.length > 0) {
          addQcWarnings(warnings)
        }
      }, {
        projectPath,
        activeWellId: resolvedWellId ?? activeWellId ?? null,
        details: { inputPath: nextPath, createNewWell, depthColumn: mapping['depth'] ?? null },
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
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
      onBrowse={handleBrowse}
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

          <ImportWizardFileField
            label={sourceType === 'las' ? 'LAS file path' : 'CSV file path'}
            value={sourcePath}
            placeholder={sourceType === 'las' ? 'D:\\data\\well.las' : 'D:\\data\\well_logs.csv'}
            onChange={setSourcePath}
          />
        </>
      ) : null}

      {currentStepIndex === 1 ? (
        sourceType === 'las' ? (
          <>
            <LasPreviewPane
              isLoading={previewLoading}
              error={previewError}
              preview={lasPreview}
              curveTypes={curveTypes}
              onCurveTypeChange={(mnemonic, type) => setCurveTypes((prev) => ({ ...prev, [mnemonic]: type }))}
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
                    <span>Depth reference</span>
                    <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
                      <option value="MD">MD</option>
                      <option value="TVD">TVD</option>
                      <option value="TVDSS">TVDSS</option>
                    </select>
                  </label>
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
          </>
        ) : (
          <>
            <TabularPreviewPane
              isLoading={previewLoading}
              error={previewError}
              preview={tabularPreview}
              settings={parserSettings}
              onSettingsChange={updateParserSettings}
              depthColumn={mapping['depth'] ?? null}
              fields={LOGS_CSV_FIELDS}
              mapping={mapping}
              onMappingChange={(fieldId, colName) => setMapping((prev) => ({ ...prev, [fieldId]: colName }))}
              curveTypes={curveTypes}
              onCurveTypeChange={(col, type) => setCurveTypes((prev) => ({ ...prev, [col]: type }))}
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
                    <span>Depth reference</span>
                    <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
                      <option value="MD">MD</option>
                      <option value="TVD">TVD</option>
                      <option value="TVDSS">TVDSS</option>
                    </select>
                  </label>
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
          </>
        )
      ) : null}

    </ImportWizardShell>
  )
}
