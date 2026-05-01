import { useMemo, useState } from 'react'

import { LinkStratChartDialog } from '../layout/LinkStratChartDialog'
import { useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { FormationTop } from '@/types'

type DialogKind = 'link-top' | 'set-top-type' | null
type FormationTypeOption = 'strat' | 'unconformity'
const FORMATION_TYPE_OPTIONS: FormationTypeOption[] = ['strat', 'unconformity']

const ZOOM_PRESETS = [
  { label: '1:200', dpp: 0.2 },
  { label: '1:500', dpp: 0.5 },
  { label: '1:1000', dpp: 1.0 },
] as const

interface SetFormationTypeDialogProps {
  formationName: string
  initialType: FormationTypeOption
  onClose: () => void
  onConfirm: (nextType: FormationTypeOption) => void | Promise<void>
}

function SetFormationTypeDialog({ formationName, initialType, onClose, onConfirm }: SetFormationTypeDialogProps) {
  const [nextType, setNextType] = useState<FormationTypeOption>(initialType)
  return (
    <div className="project-dialog">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Top type</p>
          <h2 className="project-dialog__title">{formationName}</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>Close</button>
      </header>
      <div className="project-dialog__body">
        <label className="project-dialog__field">
          <span>Type</span>
          <select value={nextType} onChange={(e) => setNextType(e.target.value as FormationTypeOption)}>
            {FORMATION_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
        <div className="project-dialog__actions" style={{ gap: 8 }}>
          <button type="button" className="project-dialog__button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="project-dialog__button project-dialog__button--primary"
            onClick={() => void onConfirm(nextType)}
          >
            Set type
          </button>
        </div>
      </div>
    </div>
  )
}

export function WellViewerToolbar() {
  const [activeDialog, setActiveDialog] = useState<DialogKind>(null)
  const [formationLinkTarget, setFormationLinkTarget] = useState<FormationTop | null>(null)

  const overviewVisible = useViewStore((state) => state.overviewVisible)
  const curveTooltipVisible = useViewStore((state) => state.curveTooltipVisible)
  const interactionMode = useViewStore((state) => state.interactionMode)
  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const setOverviewVisible = useViewStore((state) => state.setOverviewVisible)
  const setCurveTooltipVisible = useViewStore((state) => state.setCurveTooltipVisible)
  const setInteractionMode = useViewStore((state) => state.setInteractionMode)
  const setScale = useViewStore((state) => state.setScale)

  const well = useWellDataStore((state) => state.well)
  const formations = useWellDataStore((state) => state.formations)
  const stratCharts = useWellDataStore((state) => state.stratCharts)
  const addFormation = useWellDataStore((state) => state.addFormation)
  const linkFormationToChart = useWellDataStore((state) => state.linkFormationToChart)

  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)

  const selectedFormation = useMemo(
    () => formations.find((f) => f.id === selectedFormationId) ?? null,
    [formations, selectedFormationId],
  )

  function isZoomActive(dpp: number): boolean {
    return Math.abs(depthPerPixel - dpp) < 0.001
  }

  function handleFitToWell() {
    const { viewportHeight, setScroll, setScale: setScaleInner } = useViewStore.getState()
    const { fullCurves } = useWellDataStore.getState()
    if (fullCurves.length === 0) return
    let maxD = -Infinity
    for (const c of fullCurves) {
      if (c.depths.length > 0) maxD = Math.max(maxD, c.depths[c.depths.length - 1])
    }
    if (!Number.isFinite(maxD) || maxD <= 0) return
    setScroll(0)
    setScaleInner(maxD / viewportHeight)
  }

  function handleFitToContents() {
    const { viewportHeight, setScroll, setScale: setScaleInner } = useViewStore.getState()
    const { fullCurves } = useWellDataStore.getState()
    if (fullCurves.length === 0) return
    let minD = Infinity
    let maxD = -Infinity
    for (const c of fullCurves) {
      if (c.depths.length > 0) {
        minD = Math.min(minD, c.depths[0])
        maxD = Math.max(maxD, c.depths[c.depths.length - 1])
      }
    }
    if (!Number.isFinite(minD) || !Number.isFinite(maxD) || maxD <= minD) return
    setScroll(minD)
    setScaleInner((maxD - minD) / viewportHeight)
  }

  async function handleAddFormation(): Promise<void> {
    if (!well?.well_id) return
    const vs = useViewStore.getState()
    const referenceDepth = vs.cursorDepth ?? vs.visibleDepthRange.min
    await addFormation({
      name: `Top ${formations.length + 1}`,
      depth_md: Number(referenceDepth.toFixed(1)),
      color: '#9ca3af',
    })
    const latest = useWellDataStore.getState().formations.at(-1)
    if (latest) {
      setSelectedFormationId(latest.id)
      updateWellViewState(well.well_id, (state) => ({
        ...state,
        visibleFormationIds: Array.from(new Set([...state.visibleFormationIds, latest.id])),
      }))
    }
  }

  async function handleSetFormationAge(): Promise<void> {
    if (!selectedFormation) return
    const value = window.prompt('Set top age (Ma)', selectedFormation.age_ma?.toString() ?? '')
    if (value === null) return
    const trimmed = value.trim()
    const age = trimmed ? Number(trimmed) : undefined
    if (trimmed && !Number.isFinite(age)) return
    await useWellDataStore.getState().updateFormation(selectedFormation.id, { age_ma: age })
  }

  function handleSetFormationType(): void {
    if (!selectedFormation) return
    setActiveDialog('set-top-type')
  }

  async function handleMoveSelectedFormation(): Promise<void> {
    if (!selectedFormation) return
    const value = window.prompt('Move top to depth (MD)', selectedFormation.depth_md?.toString() ?? '')
    if (value === null) return
    const nextDepth = Number(value.trim())
    if (!Number.isFinite(nextDepth)) return
    void useWellDataStore.getState().updateFormationDepth(selectedFormation.id, nextDepth)
  }

  function handleOpenFormationLink(formationId: string): void {
    const formation = formations.find((f) => f.id === formationId) ?? null
    setFormationLinkTarget(formation)
    setActiveDialog('link-top')
  }

  async function handleLinkFormation(stratUnitId: number | null): Promise<void> {
    if (!formationLinkTarget) return
    const activeChart = stratCharts.find((c) => c.is_active) ?? null
    if (activeChart) {
      await linkFormationToChart(formationLinkTarget.id, activeChart.id, stratUnitId)
    }
    setFormationLinkTarget(null)
    setActiveDialog(null)
  }

  function renderDialog() {
    switch (activeDialog) {
      case 'link-top': {
        const activeChart = stratCharts.find((c) => c.is_active) ?? null
        const currentUnitId = formationLinkTarget
          ? formationLinkTarget.strat_links.find((l) => l.chart_id === activeChart?.id)?.strat_unit_id
          : undefined
        return formationLinkTarget ? (
          <LinkStratChartDialog
            formationName={formationLinkTarget.name}
            activeChartId={activeChart?.id ?? null}
            currentUnitId={currentUnitId}
            onClose={() => { setFormationLinkTarget(null); setActiveDialog(null) }}
            onSelect={handleLinkFormation}
          />
        ) : null
      }
      case 'set-top-type':
        return selectedFormation ? (
          <SetFormationTypeDialog
            formationName={selectedFormation.name}
            initialType={
              FORMATION_TYPE_OPTIONS.includes(selectedFormation.kind as FormationTypeOption)
                ? selectedFormation.kind as FormationTypeOption
                : 'strat'
            }
            onClose={() => setActiveDialog(null)}
            onConfirm={async (nextType) => {
              await useWellDataStore.getState().updateFormation(selectedFormation.id, { kind: nextType })
              setActiveDialog(null)
            }}
          />
        ) : null
      default:
        return null
    }
  }

  const dialogContent = renderDialog()

  return (
    <>
      <div className="well-viewer-toolbar" aria-label="Well viewer tools">
        <button
          type="button"
          className={`well-viewer-toolbar__button ${overviewVisible ? 'well-viewer-toolbar__button--active' : ''}`}
          onClick={() => setOverviewVisible(!overviewVisible)}
          title="Toggle well overview"
        >
          <span className="well-viewer-toolbar__button-label">Overview</span>
        </button>
        <button
          type="button"
          className={`well-viewer-toolbar__button ${curveTooltipVisible ? 'well-viewer-toolbar__button--active' : ''}`}
          onClick={() => setCurveTooltipVisible(!curveTooltipVisible)}
          title="Toggle curve tooltip"
        >
          <span className="well-viewer-toolbar__button-label">Tooltip</span>
        </button>
        <button
          type="button"
          className={`well-viewer-toolbar__button ${interactionMode === 'edit-tops' ? 'well-viewer-toolbar__button--active' : ''}`}
          onClick={() => setInteractionMode(interactionMode === 'edit-tops' ? 'view' : 'edit-tops')}
          title="Toggle top editing mode"
        >
          <span className="well-viewer-toolbar__button-label">Edit tops</span>
        </button>
        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={well === null}
          onClick={handleFitToWell}
          title="Fit view to full well"
        >
          <span className="well-viewer-toolbar__button-label">Fit well</span>
        </button>
        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={well === null}
          onClick={handleFitToContents}
          title="Fit view to curve data"
        >
          <span className="well-viewer-toolbar__button-label">Fit data</span>
        </button>

        <div className="well-viewer-toolbar__divider" />

        {ZOOM_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`well-viewer-toolbar__button ${isZoomActive(preset.dpp) ? 'well-viewer-toolbar__button--active' : ''}`}
            onClick={() => setScale(preset.dpp)}
            title={`Set scale to ${preset.label}`}
          >
            <span className="well-viewer-toolbar__button-label">{preset.label}</span>
          </button>
        ))}

        <div className="well-viewer-toolbar__divider" />

        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={well === null}
          onClick={() => void handleAddFormation()}
          title="Add formation top at cursor depth"
        >
          <span className="well-viewer-toolbar__button-label">Add top</span>
        </button>
        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={selectedFormation === null}
          onClick={() => selectedFormation && handleOpenFormationLink(selectedFormation.id)}
          title="Link selected top to stratigraphic unit"
        >
          <span className="well-viewer-toolbar__button-label">Link top</span>
        </button>
        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={selectedFormation === null}
          onClick={() => void handleSetFormationAge()}
          title="Set age of selected top"
        >
          <span className="well-viewer-toolbar__button-label">Set age</span>
        </button>
        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={selectedFormation === null}
          onClick={handleSetFormationType}
          title="Set type of selected top"
        >
          <span className="well-viewer-toolbar__button-label">Set type</span>
        </button>
        <button
          type="button"
          className="well-viewer-toolbar__button"
          disabled={selectedFormation === null}
          onClick={() => void handleMoveSelectedFormation()}
          title="Move selected top to a new depth"
        >
          <span className="well-viewer-toolbar__button-label">Move top</span>
        </button>
      </div>

      {dialogContent && (
        <div className="project-dialog-overlay">
          {dialogContent}
        </div>
      )}
    </>
  )
}
