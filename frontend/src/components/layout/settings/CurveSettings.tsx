import { useEffect, useMemo, useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
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
  const well = useWellDataStore((state) => state.well)
  const lithologyDictionaryEntries = useWellDataStore((state) => state.lithologyDictionaryEntries)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const [dictMatch, setDictMatch] = useState<CurveMatchResult | null>(null)

  const wellId = well?.well_id ?? ''
  const viewState = wellViewStates[wellId]
  const containingTrack = useMemo(
    () => viewState?.tracks.find((t) => t.curves.some((c) => c.mnemonic === selectedCurveConfig.mnemonic)) ?? null,
    [viewState, selectedCurveConfig.mnemonic],
  )

  useEffect(() => {
    void fetch(`/api/dictionary/curves/match?mnemonic=${encodeURIComponent(selectedCurveConfig.mnemonic)}`)
      .then((r) => r.ok ? r.json() as Promise<CurveMatchResult> : null)
      .then((data) => setDictMatch(data))
  }, [selectedCurveConfig.mnemonic])

  const curveType = selectedCurveConfig.curve_type ?? 'continuous'
  const isDiscrete = curveType === 'discrete'
  const isLithologyTrack = containingTrack?.track_type === 'lithology'

  const lithologyWarning = useMemo(() => {
    if (!isLithologyTrack || !containingTrack) return null
    const missing = containingTrack.curves.filter((c) => !c.lithology_code).length
    if (missing === 0) return null
    return `${missing} curve${missing > 1 ? 's' : ''} in this track ${missing > 1 ? 'have' : 'has'} no lithology code`
  }, [isLithologyTrack, containingTrack])

  function handleRenderingModeChange(nextType: 'continuous' | 'discrete') {
    if (!well) return
    onCurveSettingUpdate(selectedCurveConfig.mnemonic, { curve_type: nextType })
    void fetch(`/api/wells/${well.well_id}/curves/${encodeURIComponent(selectedCurveConfig.mnemonic)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curve_type: nextType }),
    })
  }

  function handleLithologyCodeChange(code: string) {
    onCurveSettingUpdate(selectedCurveConfig.mnemonic, { lithology_code: code || undefined })
    if (code && containingTrack && wellId) {
      updateWellViewState(wellId, (state) => ({
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === containingTrack.id ? { ...t, track_type: 'lithology' as const } : t,
        ),
      }))
    }
  }

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

  const curveData = curves.find((c) => c.mnemonic === selectedCurveConfig.mnemonic)
  const discreteCodeMap = curveData?.discrete_code_map ?? null
  const uniqueCodes = curveData
    ? Array.from(new Set(Array.from(curveData.values).filter((v) => Number.isFinite(v) && v !== curveData.null_value).map((v) => Math.round(v)))).sort((a, b) => a - b)
    : []

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
        <span>Rendering</span>
        <select
          value={curveType}
          onChange={(event) => handleRenderingModeChange(event.target.value as 'continuous' | 'discrete')}
        >
          <option value="continuous">Line</option>
          <option value="discrete">Blocks</option>
        </select>
      </label>
      {!isDiscrete && (
        <>
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
        </>
      )}
      {isDiscrete && uniqueCodes.length > 0 && (
        <div className="template-panel__group">
          <div className="template-panel__label">Codes in data</div>
          <div className="discrete-code-list">
            {uniqueCodes.map((code) => (
              <div key={code} className="discrete-code-row">
                <span className="discrete-code-row__label">
                  {discreteCodeMap?.[String(code)] ?? String(code)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="template-panel__section-header">Lithology composition</div>
      <label className="project-dialog__field">
        <span>Lithology code</span>
        <select
          value={selectedCurveConfig.lithology_code ?? ''}
          onChange={(e) => handleLithologyCodeChange(e.target.value)}
        >
          <option value="">None</option>
          {lithologyDictionaryEntries.map((entry) => (
            <option key={entry.lithology_code} value={entry.lithology_code}>
              {entry.display_name}
            </option>
          ))}
        </select>
      </label>
      {isLithologyTrack && lithologyWarning && (
        <p className="project-dialog__warning">{lithologyWarning}</p>
      )}
    </div>
  )
}
