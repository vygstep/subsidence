import { useEffect, useMemo, useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { CurveMnemonicEntryItem, TrackConfig } from '@/types'
import { type CurveType, CURVE_TYPES } from '@/utils/curveTypes'
import { buildCurveDefaults } from '@/utils/curvePresets'

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
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const patchCurveInventoryItem = useWellDataStore((state) => state.patchCurveInventoryItem)
  const lithologyDictionaryEntries = useWellDataStore((state) => state.lithologyDictionaryEntries)
  const patchCurveDiscreteCodeMap = useWellDataStore((state) => state.patchCurveDiscreteCodeMap)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const [dictMatch, setDictMatch] = useState<CurveMatchResult | null>(null)
  const [mnemonicEntries, setMnemonicEntries] = useState<CurveMnemonicEntryItem[]>([])
  const [assignedMnemonic, setAssignedMnemonic] = useState<string>('')

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

  useEffect(() => {
    void fetch('/api/mnemonic-entries')
      .then((r) => r.ok ? r.json() as Promise<CurveMnemonicEntryItem[]> : [])
      .then((data) => setMnemonicEntries(data))
  }, [])

  useEffect(() => {
    const inv = wellInventories.find((w) => w.well_id === wellId)
    const curveInv = inv?.curves.find((c) => c.mnemonic === selectedCurveConfig.mnemonic)
    setAssignedMnemonic(curveInv?.canonical_mnemonic ?? '')
  }, [wellInventories, wellId, selectedCurveConfig.mnemonic])

  const rawType = selectedCurveConfig.curve_type ?? 'continuous'
  const curveType: CurveType = (CURVE_TYPES as readonly string[]).includes(rawType) ? rawType as CurveType : 'continuous'
  const isDiscrete = curveType === 'discrete'
  const isContinuous = curveType === 'continuous'
  const isLithologyTrack = containingTrack?.track_type === 'lithology'

  const lithologyWarning = useMemo(() => {
    if (!isLithologyTrack || !containingTrack) return null
    const missing = containingTrack.curves.filter((c) => !c.lithology_code).length
    if (missing === 0) return null
    return `${missing} curve${missing > 1 ? 's' : ''} in this track ${missing > 1 ? 'have' : 'has'} no lithology code`
  }, [isLithologyTrack, containingTrack])

  function handleRenderingModeChange(nextType: CurveType) {
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

  function handleDiscreteCodeMapChange(intCode: string, lithCode: string) {
    if (!well) return
    const curveData = curves.find((c) => c.mnemonic === selectedCurveConfig.mnemonic)
    const currentMap: Record<string, string> = { ...(curveData?.discrete_code_map ?? {}) }
    if (lithCode) {
      currentMap[intCode] = lithCode
    } else {
      delete currentMap[intCode]
    }
    patchCurveDiscreteCodeMap(selectedCurveConfig.mnemonic, currentMap)
    void fetch(`/api/wells/${well.well_id}/curves/${encodeURIComponent(selectedCurveConfig.mnemonic)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discrete_code_map: JSON.stringify(currentMap) }),
    })
  }

  function applyPreset(curve: typeof curves[number], canonicalMnemonic?: string) {
    if (!well?.well_id) return
    const { curveConfig } = buildCurveDefaults(curve, 0, canonicalMnemonic)
    updateWellViewState(well.well_id, (state) => ({
      ...state,
      curveSettingsByMnemonic: { ...state.curveSettingsByMnemonic, [curve.mnemonic]: curveConfig },
      tracks: state.tracks.map((track) => ({
        ...track,
        curves: track.curves.map((c) => (c.mnemonic === curve.mnemonic ? curveConfig : c)),
      })),
    }))
  }

  function handleCanonicalMnemonicChange(value: string) {
    if (!well) return
    setAssignedMnemonic(value)
    patchCurveInventoryItem(well.well_id, selectedCurveConfig.mnemonic, { canonical_mnemonic: value || null })
    const curve = curves.find((c) => c.mnemonic === selectedCurveConfig.mnemonic)
    if (curve) applyPreset(curve, value || undefined)
    void fetch(`/api/wells/${well.well_id}/curves/${encodeURIComponent(selectedCurveConfig.mnemonic)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonical_mnemonic: value || null }),
    })
  }

  function handleRestoreDefaults() {
    const curve = curves.find((c) => c.mnemonic === selectedCurveConfig.mnemonic)
    if (!curve) return
    applyPreset(curve, assignedMnemonic || undefined)
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

  const uniqueMnemonicOptions = useMemo(() => {
    const seen = new Set<string>()
    const result: { value: string; label: string }[] = []
    for (const entry of mnemonicEntries) {
      const value = entry.canonical_mnemonic
      if (!value || seen.has(value)) continue
      seen.add(value)
      result.push({ value, label: value })
    }
    return result.sort((a, b) => a.label.localeCompare(b.label))
  }, [mnemonicEntries])

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
      {uniqueMnemonicOptions.length > 0 && (
        <div className="sf-row">
          <span>Dictionary mnemonic</span>
          <select
            value={assignedMnemonic}
            onChange={(e) => handleCanonicalMnemonicChange(e.target.value)}
          >
            <option value="">— none —</option>
            {uniqueMnemonicOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="sf-row">
        <span>Rendering</span>
        <select
          value={curveType}
          onChange={(event) => handleRenderingModeChange(event.target.value as CurveType)}
        >
          {CURVE_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'continuous' ? 'Line' : 'Blocks'}</option>
          ))}
        </select>
      </div>

      {isContinuous && (
        <>
          <div className="sf-row">
            <span>Color</span>
            <input
              type="color"
              className="sf-swatch"
              value={selectedCurveConfig.color}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { color: event.target.value })}
            />
          </div>
          <div className="sf-row">
            <span>Min</span>
            <input
              value={selectedCurveConfig.scaleMin}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMin: Number(event.target.value) })}
            />
          </div>
          <div className="sf-row">
            <span>Max</span>
            <input
              value={selectedCurveConfig.scaleMax}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMax: Number(event.target.value) })}
            />
          </div>
          <div className="sf-row">
            <span>Line width</span>
            <input
              value={selectedCurveConfig.lineWidth}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { lineWidth: Number(event.target.value) })}
            />
          </div>
          <div className="sf-row">
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
          </div>
          <div className="project-dialog__actions">
            <button
              type="button"
              className="project-dialog__button"
              onClick={applyDataDefaults}
            >
              Reset scale to data range
            </button>
            <button
              type="button"
              className="project-dialog__button"
              onClick={handleRestoreDefaults}
            >
              Restore defaults
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

      {isDiscrete && !!curveData?.lithology_set_id && (
        <>
          <div className="template-panel__section-header">Discrete lithology mapping</div>
          {uniqueCodes.length === 0 ? (
            <p className="sidebar-panel__empty">No data codes found</p>
          ) : uniqueCodes.map((code) => (
            <div key={code} className="sf-row">
              <span>Code {code}</span>
              <select
                value={discreteCodeMap?.[String(code)] ?? ''}
                onChange={(e) => handleDiscreteCodeMapChange(String(code), e.target.value)}
              >
                <option value="">— none —</option>
                {lithologyDictionaryEntries.map((entry) => (
                  <option key={entry.lithology_code} value={entry.lithology_code}>
                    {entry.display_name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}

      {isContinuous && (isLithologyTrack || !!selectedCurveConfig.lithology_code) && (
        <>
          <div className="template-panel__section-header">Lithology composition</div>
          <div className="sf-row">
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
          </div>
          {isLithologyTrack && lithologyWarning && (
            <p className="project-dialog__warning">{lithologyWarning}</p>
          )}
        </>
      )}
    </div>
  )
}
