import { useWellDataStore } from '@/stores'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface ZoneSettingsProps {
  wellId: string
  zoneSetId?: number
  onSelectZone: (zoneId: number) => void
  selectedZoneId: number | null
}

export function ZoneSettings({ wellId, zoneSetId, onSelectZone, selectedZoneId }: ZoneSettingsProps) {
  const zones = useWellDataStore((state) => state.zones)
  const well = useWellDataStore((state) => state.well)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const seaLevelCurves = useWellDataStore((state) => state.seaLevelCurves)
  const loadWell = useWellDataStore((state) => state.loadWell)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  const linkedWells = zoneSetId === undefined
    ? []
    : wellInventories.filter((item) => item.active_top_set_id === zoneSetId)
  const activeCurveId = wellInventories.find((item) => item.well_id === wellId)?.active_sea_level_curve_id ?? null
  const activeCurveName = seaLevelCurves.find((curve) => curve.id === activeCurveId)?.name ?? null

  function handleWellChange(nextWellId: string): void {
    if (zoneSetId === undefined || !nextWellId) return
    setSelectedObject({ type: 'zone-set', zoneSetId, wellId: nextWellId })
    void loadWell(nextWellId)
  }

  if (well?.well_id !== wellId) {
    return (
      <div className="template-panel">
        {zoneSetId !== undefined && linkedWells.length > 0 ? (
          <div className="sf-row">
            <span>Well</span>
            <select value={wellId} onChange={(event) => handleWellChange(event.target.value)}>
              {linkedWells.map((item) => (
                <option key={item.well_id} value={item.well_id}>
                  {item.well_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="sf-row">
          <span>Eustatic curve</span>
          <span>{activeCurveName ?? 'None'}</span>
        </div>
        <p className="sidebar-panel__empty">Zone data not loaded yet.</p>
      </div>
    )
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">{zoneSetId === undefined ? 'ZONES' : 'ZoneSet'}</div>
      </div>
      {zoneSetId !== undefined && linkedWells.length > 0 ? (
        <div className="sf-row">
          <span>Well</span>
          <select value={wellId} onChange={(event) => handleWellChange(event.target.value)}>
            {linkedWells.map((item) => (
              <option key={item.well_id} value={item.well_id}>
                {item.well_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="sf-row">
        <span>Eustatic curve</span>
        <span>{activeCurveName ?? 'None'}</span>
      </div>
      <div className="tree-leaf"><span>Total zones</span><span>{zones.length}</span></div>

      {zones.length === 0 ? (
        <p className="sidebar-panel__empty">No zones — assign a TopSet with ≥2 horizons to this well.</p>
      ) : (
        <div className="zone-settings__list">
          {zones.map((zone) => {
            const missingPick = zone.thickness_md === null
            const thickness = missingPick ? 'missing pick' : `${zone.thickness_md!.toFixed(1)} m`
            const ageSpan = zone.age_span_ma !== null ? `${zone.age_span_ma.toFixed(1)} Ma` : ''
            const isSelected = selectedZoneId === zone.zone_id
            return (
              <button
                key={zone.zone_id}
                type="button"
                className={`zone-settings__row${isSelected ? ' zone-settings__row--selected' : ''}`}
                onClick={() => onSelectZone(zone.zone_id)}
              >
                <span className="zone-settings__interval">
                  {zone.upper_horizon.name} → {zone.lower_horizon.name}
                </span>
                <span className={`zone-settings__meta${missingPick ? ' zone-settings__meta--missing' : ''}`}>
                  {thickness}
                  {!missingPick && ageSpan ? ` · ${ageSpan}` : ''}
                </span>
                {zone.lithology_fractions ? (
                  <LithologyBar fractionsJson={zone.lithology_fractions} />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LithologyBar({ fractionsJson }: { fractionsJson: string }) {
  let fracs: Record<string, number>
  try {
    fracs = JSON.parse(fractionsJson) as Record<string, number>
  } catch {
    return null
  }
  const entries = Object.entries(fracs).filter(([, v]) => v > 0)
  if (entries.length === 0) return null

  return (
    <div className="zone-settings__lith-bar" title={entries.map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`).join(', ')}>
      {entries.map(([code, frac]) => (
        <div
          key={code}
          className="zone-settings__lith-bar-segment"
          style={{ flexGrow: frac }}
          data-code={code}
        />
      ))}
    </div>
  )
}
