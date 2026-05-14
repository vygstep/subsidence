import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useNotificationStore, useProjectStore, useWorkspaceStore } from '@/stores'
import type { TopSetSummary } from '@/types'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardFileField,
  ImportWizardTargetWellSelect,
  IMPORT_WIZARD_CREATE_NEW_WELL,
  TabularPreviewPane,
  buildImportWizardSteps,
  distinctMappedValues,
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

const STEP_LABELS = ['File', 'Preview']

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
  zone_set_id?: number | null
  horizon_count?: number
  zone_count?: number
}

type TopSetPolicy = 'create' | 'existing' | 'none'

function fileBaseName(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.[^.]+$/, '')
}

export function ImportTopsDialog({ wells, activeWellId, onClose, onSuccess }: ImportTopsDialogProps) {
  const projectPath = useProjectStore((state) => state.projectPath)
  const addQcWarnings = useNotificationStore((state) => state.addQcWarnings)
  const selectedObject = useWorkspaceStore((state) => state.selectedObject)
  const selectedZoneSetId = selectedObject?.type === 'zone-set'
    ? selectedObject.zoneSetId
    : selectedObject?.type === 'zone'
      ? selectedObject.zoneSetId
      : null
  const [wellId, setWellId] = useState(activeWellId ?? '')
  const [wellPolicy, setWellPolicy] = useState<'file' | 'override' | 'create'>('override')
  const [topSets, setTopSets] = useState<TopSetSummary[]>([])
  const [zoneSetPolicy, setZoneSetPolicy] = useState<TopSetPolicy>(() => selectedZoneSetId ? 'existing' : 'create')
  const [zoneSetId, setZoneSetId] = useState(() => selectedZoneSetId ? String(selectedZoneSetId) : '')
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [zoneSetName, setZoneSetName] = useState(() => fileBaseName(getLastImportRoot()))
  const [depthRef, setDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [depthUnit, setDepthUnit] = useState<'m' | 'ft' | 'km'>('m')
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

  useEffect(() => {
    setZoneSetName(fileBaseName(csvPath))
  }, [csvPath])

  useEffect(() => {
    let cancelled = false
    async function loadTopSets() {
      try {
        const response = await fetch('/api/top-sets')
        if (!response.ok) return
        const payload = await response.json()
        if (!cancelled && Array.isArray(payload)) {
          setTopSets(payload as TopSetSummary[])
        }
      } catch {
        if (!cancelled) setTopSets([])
      }
    }
    void loadTopSets()
    return () => { cancelled = true }
  }, [projectPath])

  const fileWellSource = mapping['well_name'] ?? null
  const fileWellNames = distinctMappedValues(tabularPreview, mapping, 'well_name')
  const isMultiWell = fileWellNames.length > 1

  useEffect(() => {
    setWellPolicy(fileWellSource ? 'file' : 'override')
  }, [fileWellSource])

  const mappingErrors = validateTopsMapping(mapping)
  const mappingOk = isMappingValid(mappingErrors)
  const zoneSetOk = zoneSetPolicy !== 'existing' || zoneSetId.length > 0

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

    const useFileWell = wellPolicy === 'file'
    const createNewWell = wellPolicy === 'create'

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation(preset.executeOperation, async () => {
        const response = await fetch(preset.executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            well_id: useFileWell || createNewWell ? null : (wellId || null),
            csv_path: nextPath,
            depth_ref: depthRef,
            depth_unit: depthUnit,
            create_new_well: createNewWell,
            multi_well: isMultiWell,
            column_map: Object.keys(columnMap).length > 0 ? columnMap : null,
            zone_set_id: zoneSetPolicy === 'existing' ? Number(zoneSetId) : null,
            create_zone_set: zoneSetPolicy === 'create',
            zone_set_name: zoneSetPolicy === 'create' ? (zoneSetName.trim() || null) : null,
          }),
        })
        if (!response.ok) {
          throw new Error(await readImportError(response, `Failed to import tops (${response.status})`))
        }

        const payload = (await response.json()) as ImportTopsResponse & { qc_warnings?: string[] }
        rememberImportPath(nextPath)
        const warnings = payload.qc_warnings ?? []
        if (warnings.length > 0) {
          addQcWarnings(warnings)
        }
        await onSuccess(payload.well_id)
        onClose()
      }, {
        projectPath,
        activeWellId: useFileWell || createNewWell ? null : (wellId || activeWellId || null),
        details: { inputPath: nextPath, depthRef, depthUnit, zoneSetPolicy, createNewWell },
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
      titleId="import-tops-title"
      steps={steps}
      currentStepIndex={currentStepIndex}
      error={error}
      isSubmitting={isSubmitting}
      canAdvance={sourceIsValid}
      canSubmit={sourceIsValid && mappingOk && zoneSetOk}
      validationMessages={validationMessages}
      onClose={onClose}
      onSubmit={handleSubmit}
      onStepChange={setCurrentStepIndex}
      onBrowse={handleBrowse}
    >
      {currentStepIndex === 0 ? (
        <ImportWizardFileField
          label="Tops CSV path"
          value={csvPath}
          placeholder="D:\\data\\tops.csv"
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
            fields={TOPS_FIELDS}
            mapping={mapping}
            onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
          />

          {!previewLoading && tabularPreview && (
            <div className="import-wizard__options">
              {isMultiWell ? (
                <p className="import-preview__status">Multi-well mode: {fileWellNames.length} wells detected.</p>
              ) : null}
              <div className="import-wizard__options-row">
                <label className="project-dialog__field project-dialog__field--inline import-wizard__field import-wizard__field--wide">
                  <span>TopSet</span>
                  <select
                    value={zoneSetPolicy === 'existing' ? zoneSetId : zoneSetPolicy}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'create' || v === 'none') { setZoneSetPolicy(v) }
                      else { setZoneSetPolicy('existing'); setZoneSetId(v) }
                    }}
                  >
                    <option value="create">Create new TopSet</option>
                    {topSets.map((ts) => (
                      <option key={ts.id} value={String(ts.id)}>{ts.name}</option>
                    ))}
                    <option value="none">None</option>
                  </select>
                </label>
                {zoneSetPolicy === 'create' && (
                  <label className="project-dialog__field project-dialog__field--inline import-wizard__field import-wizard__field--wide">
                    <span>TopSet name</span>
                    <input
                      type="text"
                      value={zoneSetName}
                      onChange={(e) => setZoneSetName(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <div className="import-wizard__options-row">
                {!isMultiWell ? (
                  <ImportWizardTargetWellSelect
                    value={
                      wellPolicy === 'file'
                        ? '__file__'
                        : wellPolicy === 'create'
                          ? IMPORT_WIZARD_CREATE_NEW_WELL
                          : wellId
                    }
                    wells={wells}
                    onChange={(value) => {
                      if (value === '__file__') {
                        setWellPolicy('file')
                        setWellId('')
                      } else if (value === IMPORT_WIZARD_CREATE_NEW_WELL) {
                        setWellPolicy('create')
                        setWellId('')
                      } else {
                        setWellPolicy('override')
                        setWellId(value)
                      }
                    }}
                    emptyLabel={!fileWellSource ? 'Match or create by file well_name' : undefined}
                    extraOptions={fileWellSource ? [{ value: '__file__', label: `Use file well name: ${fileWellSource}` }] : []}
                  />
                ) : null}
                <label className="project-dialog__field project-dialog__field--inline import-wizard__field">
                  <span>Depth reference</span>
                  <select value={depthRef} onChange={(e) => setDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
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
              </div>
            </div>
          )}
        </>
      ) : null}
    </ImportWizardShell>
  )
}
