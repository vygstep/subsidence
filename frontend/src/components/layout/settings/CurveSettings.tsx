import { useEffect, useState } from 'react'

import { useWellDataStore } from '@/stores'
import type { TrackConfig } from '@/types'

interface CurveMatchResult {
  family_code: string | null
  canonical_unit: string | null
  matched: boolean
}

interface CurveSettingsProps {
  selectedCurveConfig: TrackConfig['curves'][number]
  onCurveSettingUpdate: (mnemonic: string, patch: Partial<TrackConfig['curves'][number]>) => void
}

export function CurveSettings({ selectedCurveConfig, onCurveSettingUpdate }: CurveSettingsProps) {
  const curves = useWellDataStore((state) => state.curves)
  const [dictMatch, setDictMatch] = useState<CurveMatchResult | null>(null)

  useEffect(() => {
    void fetch(`/api/dictionary/curves/match?mnemonic=${encodeURIComponent(selectedCurveConfig.mnemonic)}`)
      .then((r) => r.ok ? r.json() as Promise<CurveMatchResult> : null)
      .then((data) => setDictMatch(data))
  }, [selectedCurveConfig.mnemonic])

  function applyDataDefaults() {
    const curve = curves.find((c) => c.mnemonic === selectedCurveConfig.mnemonic)
    if (!curve) return
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < curve.values.length; i++) {
      const v = curve.values[i]
      if (!Number.isFinite(v) || v === curve.null_value) continue
      if (v < min) min = v
      if (v > max) max = v
    }
    if (!Number.isFinite(min)) return
    if (min === max) max = min + 1
    onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMin: min, scaleMax: max })
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Curve</div>
        <div className="template-panel__value">{selectedCurveConfig.mnemonic}</div>
      </div>
      <div className="tree-leaf"><span>Unit</span><span>{selectedCurveConfig.unit || '-'}</span></div>
      {dictMatch?.matched && (
        <div className="tree-leaf"><span>Family</span><span>{dictMatch.family_code ?? '-'}</span></div>
      )}
      <label className="project-dialog__field">
        <span>Color</span>
        <input
          type="color"
          value={selectedCurveConfig.color}
          onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { color: event.target.value })}
        />
      </label>
      <div className="project-dialog__grid">
        <label className="project-dialog__field">
          <span>Min</span>
          <input
            value={selectedCurveConfig.scaleMin}
            onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMin: Number(event.target.value) })}
          />
        </label>
        <label className="project-dialog__field">
          <span>Max</span>
          <input
            value={selectedCurveConfig.scaleMax}
            onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMax: Number(event.target.value) })}
          />
        </label>
        <label className="project-dialog__field">
          <span>Line width</span>
          <input
            value={selectedCurveConfig.lineWidth}
            onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { lineWidth: Number(event.target.value) })}
          />
        </label>
        <label className="project-dialog__field">
          <span>Line style</span>
          <select
            value={selectedCurveConfig.lineStyle}
            onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, {
              lineStyle: event.target.value as TrackConfig['curves'][number]['lineStyle'],
            })}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
      </div>
      <div className="project-dialog__actions">
        <button
          type="button"
          className="project-dialog__button"
          onClick={applyDataDefaults}
        >
          Reset scale to data range
        </button>
      </div>
    </div>
  )
}
