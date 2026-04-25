import { useState } from 'react'
import type { FormEvent } from 'react'

import { useProjectStore } from '@/stores'
import { recordOperation } from '@/utils/diagnostics'

import {
  ImportWizardShell,
  ImportWizardTargetWellFields,
  buildImportWizardSteps,
  importWizardPresets,
  readImportError,
} from './importWizard'
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
  const [csvPath, setCsvPath] = useState(() => getLastImportRoot())
  const [depthRef, setDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastImportRoot = getLastImportRoot()
  const preset = importWizardPresets.tops
  const sourceIsValid = csvPath.trim().length > 0
  const steps = buildImportWizardSteps(currentStepIndex, sourceIsValid)
  const validationMessages = sourceIsValid ? [] : ['CSV path is required.']

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = csvPath.trim()
    if (!nextPath) {
      setError('CSV path is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await recordOperation(preset.executeOperation, async () => {
        const response = await fetch(preset.executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            well_id: wellId || null,
            csv_path: nextPath,
            depth_ref: depthRef,
            create_new_well: !wellId && createNewWell,
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
        activeWellId: wellId || activeWellId || null,
        details: { inputPath: nextPath, depthRef, createNewWell },
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
      canAdvance={currentStepIndex === 0 ? sourceIsValid : true}
      canSubmit={sourceIsValid}
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
        <>
          <ImportWizardTargetWellFields
            wells={wells}
            wellId={wellId}
            createNewWell={createNewWell}
            emptyLabel="Reuse by file well_name / create from defaults"
            onWellIdChange={setWellId}
            onCreateNewWellChange={setCreateNewWell}
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

      {currentStepIndex === 2 ? (
        <div className="project-dialog__validation" aria-label="Import summary">
          <span>Source: {csvPath.trim()}</span>
          <span>Target: {wellId || 'file well_name / defaults'}</span>
          <span>Depth reference: {depthRef}</span>
        </div>
      ) : null}
    </ImportWizardShell>
  )
}
