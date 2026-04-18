import type { CurveData, FormationTop, Well } from '@/types'

interface WellDataPanelProps {
  well: Well | null
  curves: CurveData[]
  formations: FormationTop[]
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function fileLabel(path: string | null | undefined): string {
  if (!path) {
    return 'Imported curves'
  }
  const normalized = path.replaceAll('\\', '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

export function WellDataPanel({ well, curves, formations }: WellDataPanelProps) {
  if (!well) {
    return (
      <div className="sidebar-panel__body">
        <p className="sidebar-panel__empty">No well loaded.</p>
      </div>
    )
  }

  const hasLas = curves.length > 0
  const hasTops = formations.length > 0
  const hasDeviation = Boolean(well.deviation)

  return (
    <div className="sidebar-panel__body">
      <details className="tree-node tree-node--root" open>
        <summary className="tree-node__summary">{well.well_name}</summary>

        <div className="tree-node__children">
          <details className="tree-node" open>
            <summary className="tree-node__summary">Well metadata</summary>
            <div className="tree-node__children">
              <div className="tree-leaf"><span>Name</span><span>{well.well_name}</span></div>
              <div className="tree-leaf"><span>Location (X, Y)</span><span>{formatNumber(well.x)}, {formatNumber(well.y)}</span></div>
              <div className="tree-leaf"><span>KB / GL</span><span>{formatNumber(well.kb_elev)} / {formatNumber(well.gl_elev)}</span></div>
              <div className="tree-leaf"><span>TD</span><span>{formatNumber(well.td_md)}</span></div>
              <div className="tree-leaf"><span>CRS</span><span>{well.crs || 'unset'}</span></div>
            </div>
          </details>

          <details className="tree-node" open>
            <summary className="tree-node__summary">LAS</summary>
            <div className="tree-node__children">
              {hasLas ? (
                <details className="tree-node" open>
                  <summary className="tree-node__summary">{fileLabel(well.source_las_path)}</summary>
                  <div className="tree-node__children">
                    {curves.map((curve) => (
                      <div key={curve.mnemonic} className="tree-leaf">
                        <span>{curve.mnemonic}</span>
                        <span>{curve.unit || '—'}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : (
                <p className="sidebar-panel__empty">No LAS loaded.</p>
              )}
            </div>
          </details>

          <details className="tree-node" open>
            <summary className="tree-node__summary">TOPS</summary>
            <div className="tree-node__children">
              {hasTops ? (
                formations.map((formation) => (
                  <div key={formation.id} className="tree-leaf">
                    <span>{formation.name}</span>
                    <span>{formatNumber(formation.depth_md)}</span>
                  </div>
                ))
              ) : (
                <p className="sidebar-panel__empty">No tops loaded.</p>
              )}
            </div>
          </details>

          <details className="tree-node" open>
            <summary className="tree-node__summary">DEV</summary>
            <div className="tree-node__children">
              {hasDeviation ? (
                <>
                  <div className="tree-leaf"><span>Reference</span><span>{well.deviation?.reference}</span></div>
                  <div className="tree-leaf"><span>Mode</span><span>{well.deviation?.mode}</span></div>
                  {(well.deviation?.fields ?? []).map((field) => (
                    <div key={field} className="tree-leaf">
                      <span>{field}</span>
                      <span>Loaded</span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="sidebar-panel__empty">No deviation loaded.</p>
              )}
            </div>
          </details>
        </div>
      </details>
    </div>
  )
}
