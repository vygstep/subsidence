import { useState, useEffect } from 'react'

import type { SeaLevelCurve, Well } from '@/types'
import { useWellDataStore } from '@/stores'

export interface WellInspectorDraft {
  well_name: string
  x: string
  y: string
  kb_elev: string
  gl_elev: string
  td_md: string
  crs: string
}

interface WellSettingsProps {
  well: Well
  wellInspectorDraft: WellInspectorDraft
  onWellInspectorDraftChange: (field: keyof WellInspectorDraft, value: string) => void
  onSaveWellInspector: () => void | Promise<void>
}

export function WellSettings({ well: _well, wellInspectorDraft, onWellInspectorDraftChange, onSaveWellInspector }: WellSettingsProps) {
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const loadSeaLevelCurves = useWellDataStore((state) => state.loadSeaLevelCurves)
  const setWellActiveSeaLevelCurve = useWellDataStore((state) => state.setWellActiveSeaLevelCurve)

  const inventory = wellInventories.find((w) => w.well_id === _well.well_id)
  const activeCurveId = inventory?.active_sea_level_curve_id ?? null

  const [curves, setCurves] = useState<SeaLevelCurve[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void loadSeaLevelCurves().then(setCurves)
  }, [loadSeaLevelCurves])

  async function handleSeaLevelChange(value: string) {
    const curveId = value === '' ? null : parseInt(value, 10)
    setIsSaving(true)
    try {
      await setWellActiveSeaLevelCurve(_well.well_id, curveId)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">Well settings</div>
      </div>
      <label className="project-dialog__field">
        <span>Well name</span>
        <input
          value={wellInspectorDraft.well_name}
          onChange={(event) => onWellInspectorDraftChange('well_name', event.target.value)}
        />
      </label>
      <div className="project-dialog__grid">
        <label className="project-dialog__field">
          <span>Project X</span>
          <input value={wellInspectorDraft.x} onChange={(event) => onWellInspectorDraftChange('x', event.target.value)} />
        </label>
        <label className="project-dialog__field">
          <span>Project Y</span>
          <input value={wellInspectorDraft.y} onChange={(event) => onWellInspectorDraftChange('y', event.target.value)} />
        </label>
        <label className="project-dialog__field">
          <span>KB</span>
          <input
            value={wellInspectorDraft.kb_elev}
            onChange={(event) => onWellInspectorDraftChange('kb_elev', event.target.value)}
          />
        </label>
        <label className="project-dialog__field">
          <span>GL</span>
          <input
            value={wellInspectorDraft.gl_elev}
            onChange={(event) => onWellInspectorDraftChange('gl_elev', event.target.value)}
          />
        </label>
        <label className="project-dialog__field">
          <span>TD</span>
          <input
            value={wellInspectorDraft.td_md}
            onChange={(event) => onWellInspectorDraftChange('td_md', event.target.value)}
          />
        </label>
        <label className="project-dialog__field">
          <span>CRS</span>
          <input value={wellInspectorDraft.crs} onChange={(event) => onWellInspectorDraftChange('crs', event.target.value)} />
        </label>
      </div>
      <div className="project-dialog__actions">
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void onSaveWellInspector()}
        >
          Save well
        </button>
      </div>

      <div className="template-panel__section-header">Sea level correction</div>
      <label className="project-dialog__field">
        <span>Eustatic sea level curve</span>
        <select
          value={activeCurveId ?? ''}
          onChange={(e) => void handleSeaLevelChange(e.target.value)}
          disabled={isSaving}
        >
          <option value="">None</option>
          {curves.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.point_count > 0 ? ` (${c.point_count} pts)` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
