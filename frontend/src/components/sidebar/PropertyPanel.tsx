import { useState } from 'react'

import { useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { CurveConfig, TrackConfig } from '@/types'

function SectionHeader({ label, value }: { label: string; value: string }) {
  return (
    <div className="template-panel__group">
      <div className="template-panel__label">{label}</div>
      <div className="template-panel__value">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="project-dialog__field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function CurveEditor({ mnemonic, wellId }: { mnemonic: string; wellId: string }) {
  const updateWellViewState = useWorkspaceStore((s) => s.updateWellViewState)
  const colorOverrides = useWellDataStore((s) => s.colorOverrides)
  const setColorOverrides = useWellDataStore((s) => s.setColorOverrides)
  const wellViewStates = useWorkspaceStore((s) => s.wellViewStates)

  const curveConfig: CurveConfig | undefined = wellViewStates[wellId]?.tracks
    .flatMap((t) => t.curves)
    .find((c) => c.mnemonic === mnemonic)

  if (!curveConfig) {
    return <p className="sidebar-panel__empty">Curve not found in current tracks.</p>
  }

  function update(patch: Partial<CurveConfig>) {
    updateWellViewState(wellId, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => ({
        ...track,
        curves: track.curves.map((c) => (c.mnemonic === mnemonic ? { ...c, ...patch } : c)),
      })),
    }))
    if (patch.color !== undefined) {
      setColorOverrides({ ...colorOverrides, [mnemonic]: patch.color })
    }
  }

  return (
    <div className="template-panel">
      <SectionHeader label="Curve" value={mnemonic} />
      {curveConfig.unit && (
        <div className="tree-leaf"><span>Unit</span><span>{curveConfig.unit}</span></div>
      )}
      <Field label="Color">
        <input type="color" value={colorOverrides[mnemonic] ?? curveConfig.color}
          onChange={(e) => update({ color: e.target.value })} />
      </Field>
      <div className="project-dialog__grid">
        <Field label="Min">
          <input type="number" value={curveConfig.scaleMin}
            onChange={(e) => update({ scaleMin: Number(e.target.value) })} />
        </Field>
        <Field label="Max">
          <input type="number" value={curveConfig.scaleMax}
            onChange={(e) => update({ scaleMax: Number(e.target.value) })} />
        </Field>
        <Field label="Width">
          <input type="range" min={0.5} max={4} step={0.5} value={curveConfig.lineWidth}
            onChange={(e) => update({ lineWidth: Number(e.target.value) })} />
        </Field>
        <Field label="Style">
          <select value={curveConfig.lineStyle}
            onChange={(e) => update({ lineStyle: e.target.value as CurveConfig['lineStyle'] })}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </Field>
      </div>
    </div>
  )
}

function TrackEditor({ trackId, wellId }: { trackId: string; wellId: string }) {
  const updateWellViewState = useWorkspaceStore((s) => s.updateWellViewState)
  const wellViewStates = useWorkspaceStore((s) => s.wellViewStates)

  const track: TrackConfig | undefined = wellViewStates[wellId]?.tracks.find((t) => t.id === trackId)

  if (!track) {
    return <p className="sidebar-panel__empty">Track not found.</p>
  }

  function update(patch: Partial<TrackConfig>) {
    updateWellViewState(wellId, (state) => ({
      ...state,
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
    }))
  }

  return (
    <div className="template-panel">
      <SectionHeader label="Track" value={track.title} />
      <Field label="Title">
        <input value={track.title} onChange={(e) => update({ title: e.target.value })} />
      </Field>
      <div className="project-dialog__grid">
        <Field label="Grid">
          <input type="checkbox" checked={track.showGrid}
            onChange={(e) => update({ showGrid: e.target.checked })} />
        </Field>
        <Field label="Divisions">
          <input type="number" min={1} max={20} value={track.gridDivisions}
            onChange={(e) => update({ gridDivisions: Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  )
}

function FormationEditor({ formationId }: { formationId: string }) {
  const formations = useWellDataStore((s) => s.formations)
  const updateFormation = useWellDataStore((s) => s.updateFormation)
  const updateFormationDepth = useWellDataStore((s) => s.updateFormationDepth)

  const formation = formations.find((f) => f.id === formationId)

  if (!formation) {
    return <p className="sidebar-panel__empty">Formation not found.</p>
  }

  return (
    <div className="template-panel">
      <SectionHeader label="Formation" value={formation.name} />
      <Field label="Name">
        <input value={formation.name}
          onChange={(e) => void updateFormation(formationId, { name: e.target.value })} />
      </Field>
      <div className="project-dialog__grid">
        <Field label="Depth">
          <input type="number" step={0.1} value={formation.depth_md}
            onChange={(e) => void updateFormationDepth(formationId, Number(e.target.value))} />
        </Field>
        <Field label="Color">
          <input type="color" value={formation.color}
            onChange={(e) => void updateFormation(formationId, { color: e.target.value })} />
        </Field>
        <Field label="Type">
          <select value={formation.kind}
            onChange={(e) => void updateFormation(formationId, { kind: e.target.value })}>
            <option value="strat">strat</option>
            <option value="unconformity">unconformity</option>
          </select>
        </Field>
        <Field label="Locked">
          <input type="checkbox" checked={formation.is_locked}
            onChange={(e) => void updateFormation(formationId, { is_locked: e.target.checked })} />
        </Field>
      </div>
      {formation.active_strat_unit_name && (
        <div className="tree-leaf"><span>Linked unit</span><span>{formation.active_strat_unit_name}</span></div>
      )}
    </div>
  )
}

export function PropertyPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const selectedElementId = useViewStore((s) => s.selectedElementId)
  const selectedElementType = useViewStore((s) => s.selectedElementType)
  const well = useWellDataStore((s) => s.well)

  return (
    <aside className={`property-panel ${collapsed ? 'property-panel--collapsed' : ''}`}>
      <button
        type="button"
        className="property-panel__toggle"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand properties' : 'Collapse properties'}
      >
        {collapsed ? '‹' : '›'}
      </button>
      {!collapsed && (
        <div className="property-panel__body">
          {!selectedElementId || !selectedElementType ? (
            <p className="sidebar-panel__empty">Click a curve, track, or formation to inspect.</p>
          ) : selectedElementType === 'curve' && well ? (
            <CurveEditor mnemonic={selectedElementId} wellId={well.well_id} />
          ) : selectedElementType === 'track' && well ? (
            <TrackEditor trackId={selectedElementId} wellId={well.well_id} />
          ) : selectedElementType === 'formation' ? (
            <FormationEditor formationId={selectedElementId} />
          ) : (
            <p className="sidebar-panel__empty">No editor available for this selection.</p>
          )}
        </div>
      )}
    </aside>
  )
}
