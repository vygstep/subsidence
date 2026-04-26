import { useState, useEffect } from 'react'

import type { FormationZone, LithologyDictionaryEntry } from '@/types'
import { useWellDataStore } from '@/stores'

interface FracRow {
  code: string
  percent: number
}

function fractionsFromJson(json: string | null): FracRow[] {
  if (!json) return []
  try {
    const obj = JSON.parse(json) as Record<string, number>
    return Object.entries(obj).map(([code, v]) => ({ code, percent: Math.round(v * 100) }))
  } catch {
    return []
  }
}

function fractionsToJson(rows: FracRow[]): string {
  const obj: Record<string, number> = {}
  for (const row of rows) {
    if (row.code) obj[row.code] = row.percent / 100
  }
  return JSON.stringify(obj)
}

interface ZoneDetailSettingsProps {
  zone: FormationZone
}

export function ZoneDetailSettings({ zone }: ZoneDetailSettingsProps) {
  const lithologyEntries = useWellDataStore((state) => state.lithologyDictionaryEntries)
  const updateZoneLithology = useWellDataStore((state) => state.updateZoneLithology)
  const wellId = useWellDataStore((state) => state.well?.well_id ?? '')

  const [showEditor, setShowEditor] = useState(zone.lithology_fractions !== null)
  const [rows, setRows] = useState<FracRow[]>(() => fractionsFromJson(zone.lithology_fractions))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync if zone changes externally
  useEffect(() => {
    setRows(fractionsFromJson(zone.lithology_fractions))
    setShowEditor(zone.lithology_fractions !== null)
    setSaveError(null)
  }, [zone.zone_id, zone.lithology_fractions])

  const total = rows.reduce((s, r) => s + r.percent, 0)
  const totalOk = total <= 100

  function addRow() {
    const usedCodes = new Set(rows.map((r) => r.code))
    const firstAvailable = lithologyEntries.find((e) => !usedCodes.has(e.lithology_code))
    setRows((prev) => [...prev, { code: firstAvailable?.lithology_code ?? '', percent: 0 }])
  }

  function updateRow(index: number, field: 'code' | 'percent', value: string | number) {
    setRows((prev) => prev.map((row, i) =>
      i === index ? { ...row, [field]: field === 'percent' ? Number(value) : value } : row
    ))
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!totalOk || isSaving) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const fractionsJson = rows.length > 0 ? fractionsToJson(rows) : null
      await updateZoneLithology(zone.zone_id, fractionsJson, 'manual')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  function handleClear() {
    setRows([])
    setShowEditor(false)
  }

  const thickness = zone.thickness_md !== null ? `${zone.thickness_md.toFixed(1)} m` : '—'
  const thicknessTvd = zone.thickness_tvd !== null ? `${zone.thickness_tvd.toFixed(1)} m` : null
  const ageSpan = zone.age_span_ma !== null ? `${zone.age_span_ma.toFixed(2)} Ma` : '—'
  const hiatus = zone.hiatus_ma !== null ? `${zone.hiatus_ma.toFixed(2)} Ma` : null

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Zone</div>
        <div className="template-panel__value">{zone.upper_horizon.name} → {zone.lower_horizon.name}</div>
      </div>

      <div className="tree-leaf">
        <span>Thickness (MD)</span>
        <span className="tree-leaf__grey">{thickness}</span>
      </div>
      {thicknessTvd !== null ? (
        <div className="tree-leaf">
          <span>Thickness (TVD)</span>
          <span className="tree-leaf__grey">{thicknessTvd}</span>
        </div>
      ) : null}
      <div className="tree-leaf">
        <span>Age span</span>
        <span className="tree-leaf__grey">{ageSpan}</span>
      </div>
      {hiatus !== null ? (
        <div className="tree-leaf">
          <span>Hiatus</span>
          <span className="tree-leaf__grey">{hiatus}</span>
        </div>
      ) : null}

      <div className="template-panel__section-header">Lithology</div>

      {!showEditor ? (
        <button type="button" className="project-dialog__path-action" onClick={() => { setShowEditor(true); addRow() }}>
          Add lithology
        </button>
      ) : (
        <div className="zone-detail__lith-editor">
          {rows.map((row, i) => (
            <div key={i} className="zone-detail__lith-row">
              <select
                value={row.code}
                onChange={(e) => updateRow(i, 'code', e.target.value)}
                className="zone-detail__lith-select"
              >
                {row.code === '' ? <option value="">— select —</option> : null}
                {lithologyEntries.map((entry: LithologyDictionaryEntry) => (
                  <option key={entry.lithology_code} value={entry.lithology_code}>
                    {entry.display_name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={row.percent}
                onChange={(e) => updateRow(i, 'percent', e.target.value)}
                className="zone-detail__lith-pct"
              />
              <span className="zone-detail__lith-pct-label">%</span>
              <button type="button" className="zone-detail__lith-remove" onClick={() => removeRow(i)}>×</button>
            </div>
          ))}

          <button type="button" className="project-dialog__path-action" onClick={addRow}>
            + Add row
          </button>

          <div className={`zone-detail__lith-total${!totalOk ? ' zone-detail__lith-total--error' : ''}`}>
            Total: {total}% {!totalOk ? `(must be ≤ 100%)` : ''}
          </div>

          {saveError ? <p className="project-dialog__error">{saveError}</p> : null}

          <div className="zone-detail__lith-actions">
            <button
              type="button"
              className="project-dialog__path-action"
              onClick={() => void handleSave()}
              disabled={!totalOk || isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="project-dialog__path-action"
              onClick={handleClear}
              disabled={isSaving}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {zone.lithology_source === 'auto' ? (
        <div className="tree-leaf">
          <span>Source</span>
          <span className="zone-detail__source-badge">from log</span>
        </div>
      ) : null}
    </div>
  )
}
