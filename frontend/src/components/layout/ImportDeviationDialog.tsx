import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useNotificationStore, useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardFileField,
  ImportWizardTargetWellSelect,
  IMPORT_WIZARD_CREATE_NEW_WELL,
  TabularPreviewPane,
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

const STEP_LABELS = ['File', 'Preview']

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

  const mappingErrors = validateDeviationMapping(mapping)
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
    const createNewWell = wellSelection === IMPORT_WIZARD_CREATE_NEW_WELL
    const resolvedWellId = createNewWell ? null : (wellSelection || null)

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
      setError(cause instanceof Error ? cause.message : 'Failed to import deviation')
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
      titleId="import-deviation-title"
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
          label="Deviation CSV path"
          value={csvPath}
          placeholder="D:\\data\\deviation.csv"
          onChange={setCsvPath}
        />
      ) : null}

      {currentStepIndex === 1 ? (
        <>
          <TabularPreviewPane
            isLoading={previewLoading}
            error={previewError}
            preview={tabularPreview}
            settings={parserSettings}
            onSettingsChange={updateParserSettings}
            fields={DEVIATION_FIELDS}
            mapping={mapping}
            onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
          />

          {!previewLoading && tabularPreview && (
            <div className="import-wizard__options">
              <div className="import-wizard__options-row">
                <ImportWizardTargetWellSelect
                  wells={wells}
                  value={wellSelection}
                  emptyLabel="Use file well_name / create from defaults"
                  onChange={setWellSelection}
                />
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
    </ImportWizardShell>
  )
}
