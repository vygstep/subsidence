import { useState } from 'react'

import type { Well } from '@/types'
import { useWellDataStore } from '@/stores'

export interface WellInspectorDraft {
  well_name: string
  color_hex: string
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
  const seaLevelCurves = useWellDataStore((state) => state.seaLevelCurves)
  const setWellActiveSeaLevelCurve = useWellDataStore((state) => state.setWellActiveSeaLevelCurve)

  const inventory = wellInventories.find((w) => w.well_id === _well.well_id)
  const activeCurveId = inventory?.active_sea_level_curve_id ?? null

  const [isSaving, setIsSaving] = useState(false)
  const colorPickerValue = /^#[0-9a-fA-F]{6}$/.test(wellInspectorDraft.color_hex)
    ? wellInspectorDraft.color_hex
    : _well.color_hex

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
      <div className="sf-row">
        <span>Well name</span>
        <input
          value={wellInspectorDraft.well_name}
          onChange={(event) => onWellInspectorDraftChange('well_name', event.target.value)}
        />
      </div>
      <div className="sf-row">
        <span>Color</span>
        <div className="sf-color-field">
          <input
            type="color"
            value={colorPickerValue}
            onChange={(event) => onWellInspectorDraftChange('color_hex', event.target.value)}
            aria-label="Well color"
          />
          <input
            type="text"
            value={wellInspectorDraft.color_hex}
            onChange={(event) => onWellInspectorDraftChange('color_hex', event.target.value)}
          />
        </div>
      </div>
      <div className="sf-row">
        <span>Project X</span>
        <input value={wellInspectorDraft.x} onChange={(event) => onWellInspectorDraftChange('x', event.target.value)} />
      </div>
      <div className="sf-row">
        <span>Project Y</span>
        <input value={wellInspectorDraft.y} onChange={(event) => onWellInspectorDraftChange('y', event.target.value)} />
      </div>
      <div className="sf-row">
        <span>KB</span>
        <input
          value={wellInspectorDraft.kb_elev}
          onChange={(event) => onWellInspectorDraftChange('kb_elev', event.target.value)}
        />
      </div>
      <div className="sf-row">
        <span>GL</span>
        <input
          value={wellInspectorDraft.gl_elev}
          onChange={(event) => onWellInspectorDraftChange('gl_elev', event.target.value)}
        />
      </div>
      <div className="sf-row">
        <span>TD</span>
        <input
          value={wellInspectorDraft.td_md}
          onChange={(event) => onWellInspectorDraftChange('td_md', event.target.value)}
        />
      </div>
      <div className="sf-row">
        <span>CRS</span>
        <input value={wellInspectorDraft.crs} onChange={(event) => onWellInspectorDraftChange('crs', event.target.value)} />
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
      <div className="sf-row">
        <span>Eustatic curve</span>
        <select
          value={activeCurveId ?? ''}
          onChange={(e) => void handleSeaLevelChange(e.target.value)}
          disabled={isSaving}
        >
          <option value="">None</option>
          {seaLevelCurves.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.point_count > 0 ? ` (${c.point_count} pts)` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
