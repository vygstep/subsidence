import { useWellDataStore } from '@/stores'

interface ZoneSettingsProps {
  wellId: string
  onSelectZone: (zoneId: number) => void
  selectedZoneId: number | null
}

export function ZoneSettings({ wellId, onSelectZone, selectedZoneId }: ZoneSettingsProps) {
  const zones = useWellDataStore((state) => state.zones)
  const well = useWellDataStore((state) => state.well)

  if (well?.well_id !== wellId) {
    return <p className="sidebar-panel__empty">Zone data not loaded yet.</p>
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">ZONES</div>
      </div>
      <div className="tree-leaf"><span>Total zones</span><span>{zones.length}</span></div>

      {zones.length === 0 ? (
        <p className="sidebar-panel__empty">No zones — assign a TopSet with ≥2 horizons to this well.</p>
      ) : (
        <div className="zone-settings__list">
          {zones.map((zone) => {
            const thickness = zone.thickness_md !== null ? `${zone.thickness_md.toFixed(1)} m` : '—'
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
                <span className="zone-settings__meta">
                  {thickness}
                  {ageSpan ? ` · ${ageSpan}` : ''}
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
