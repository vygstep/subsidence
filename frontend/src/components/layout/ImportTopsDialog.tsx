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
  TOPS_FIELDS,
  autoMap,
  isMappingValid,
  validateTopsMapping,
} from './importWizard/mapping'
import type { ColumnMapping } from './importWizard/mapping'
import { getLastImportRoot, pickFile, rememberImportPath } from './pathMemory'

interface WellOption {
  well_id: string
  well_name: string
}

interface ImportTopsDialogProps {
  wells: WellOption[]
  activeWellId?: string | null
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportTopsResponse {
  well_id: string
}

export function ImportTopsDialog({ wells, activeWellId, onClose, onSuccess }: ImportTopsDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const [wellId, setWellId] = useState(activeWellId ?? '')
  const [createNewWell, setCreateNewWell] = useState(false)
  const [wellPolicy, setWellPolicy] = useState<'file' | 'override'>('override')
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [depthRef, setDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.tops
  const sourceIsValid = csvPath.trim().length > 0
  const isOnPreviewStep = currentStepIndex === 1

  const { isLoading: previewLoading, error: previewError, tabularPreview, parserSettings, updateParserSettings } = useImportPreview(
    'tabular',
    csvPath,
    isOnPreviewStep,
  )

  useEffect(() => {
    if (tabularPreview) {
      setMapping(autoMap(tabularPreview.columns, TOPS_FIELDS))
    }
  }, [tabularPreview])

  // The file well source is the mapped column name when well_name is mapped.
  const fileWellSource = mapping['well_name'] ?? null

  useEffect(() => {
    setWellPolicy(fileWellSource ? 'file' : 'override')
  }, [fileWellSource])

  const previewReady = !previewLoading && tabularPreview !== null
  const mappingErrors = validateTopsMapping(mapping)
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

    const useFileWell = wellPolicy === 'file'

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation(preset.executeOperation, async () => {
        const response = await fetch(preset.executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            well_id: useFileWell ? null : (wellId || null),
            csv_path: nextPath,
            depth_ref: depthRef,
            create_new_well: useFileWell ? false : (!wellId && createNewWell),
            column_map: Object.keys(columnMap).length > 0 ? columnMap : null,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Failed to import tops (${response.status})`))
        }

        const payload = (await response.json()) as ImportTopsResponse
        rememberImportPath(nextPath)
        await onSuccess(payload.well_id)
        onClose()
      }, {
        projectPath,
        activeWellId: useFileWell ? null : (wellId || activeWellId || null),
        details: { inputPath: nextPath, depthRef, createNewWell: useFileWell ? false : createNewWell },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import tops')
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
      titleId="import-tops-title"
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
          <span>Tops CSV path</span>
          <div className="project-dialog__field-row">
            <input
              type="text"
              value={csvPath}
              onChange={(event) => setCsvPath(event.target.value)}
              placeholder="D:\\data\\tops.csv"
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
          fields={TOPS_FIELDS}
          mapping={mapping}
          validationErrors={mappingErrors}
          onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
        />
      ) : null}

      {currentStepIndex === 3 ? (
        <>
          <ImportWizardTargetWellFields
            wells={wells}
            wellId={wellId}
            createNewWell={createNewWell}
            emptyLabel="Create or match by file well_name"
            fileWellSource={fileWellSource}
            wellPolicy={wellPolicy}
            onWellIdChange={setWellId}
            onCreateNewWellChange={setCreateNewWell}
            onWellPolicyChange={setWellPolicy}
          />
          <label className="project-dialog__field">
            <span>Depth reference</span>
            <select value={depthRef} onChange={(event) => setDepthRef(event.target.value as 'MD' | 'TVD' | 'TVDSS')}>
              <option value="MD">MD</option>
              <option value="TVD">TVD</option>
              <option value="TVDSS">TVDSS</option>
            </select>
          </label>
        </>
      ) : null}

      {currentStepIndex === 4 ? (
        <div className="project-dialog__validation" aria-label="Import summary">
          <span>Source: {csvPath.trim()}</span>
          <span>Target: {wellPolicy === 'file' ? `file well names (${fileWellSource})` : (wellId || 'new well')}</span>
          <span>Depth reference: {depthRef}</span>
        </div>
      ) : null}
    </ImportWizardShell>
  )
}
