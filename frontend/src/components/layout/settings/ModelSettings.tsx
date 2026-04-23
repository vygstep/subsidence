import { useEffect, useState } from 'react'

import { useWellDataStore } from '@/stores'
import type { CompactionModel, LithologyParam } from '@/types'

export function ModelSettings({ model }: { model: CompactionModel }) {
  const fetchCompactionModelParams = useWellDataStore((state) => state.fetchCompactionModelParams)
  const updateCompactionModelParam = useWellDataStore((state) => state.updateCompactionModelParam)
  const renameCompactionModel = useWellDataStore((state) => state.renameCompactionModel)

  const [params, setParams] = useState<LithologyParam[]>([])
  const [nameDraft, setNameDraft] = useState(model.name)

  useEffect(() => {
    setNameDraft(model.name)
  }, [model.name])

  useEffect(() => {
    void fetchCompactionModelParams(model.id).then(setParams)
  }, [model.id, fetchCompactionModelParams])

  async function handleParamBlur(lithologyCode: string, field: 'density' | 'porosity_surface' | 'compaction_coeff', value: string) {
    const num = parseFloat(value)
    if (!Number.isFinite(num)) return
    try {
      const updated = await updateCompactionModelParam(model.id, lithologyCode, { [field]: num })
      setParams((prev) => prev.map((p) => (p.lithology_code === lithologyCode ? { ...p, ...updated } : p)))
      const { useComputedStore } = await import('@/stores/computedStore')
      useComputedStore.getState().triggerRecalculation()
    } catch (err) {
      window.alert(String(err))
    }
  }

  async function handleRenameBlur() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === model.name) return
    try {
      await renameCompactionModel(model.id, trimmed)
    } catch (err) {
      window.alert(String(err))
      setNameDraft(model.name)
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Legacy Runtime Model</div>
        <div className="template-panel__value">{model.name}</div>
      </div>
      {model.is_builtin ? (
        <div className="tree-leaf"><span>Kind</span><span>Built-in legacy model</span></div>
      ) : (
        <label className="project-dialog__field">
          <span>Name</span>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void handleRenameBlur()}
          />
        </label>
      )}
      <div className="template-panel__group" style={{ marginTop: 8 }}>
        <div className="template-panel__label">Legacy Runtime Parameters</div>
      </div>
      <div className="compaction-table-wrapper">
        <table className="compaction-table">
          <thead>
            <tr>
              <th>Lithology</th>
              <th title="Grain density kg/m³">ρ</th>
              <th title="Surface porosity (fraction)">φ₀</th>
              <th title="Compaction coefficient km⁻¹">c</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.lithology_code}>
                <td title={p.display_name}>{p.lithology_code}</td>
                {model.is_builtin ? (
                  <>
                    <td>{p.density.toFixed(0)}</td>
                    <td>{p.porosity_surface.toFixed(3)}</td>
                    <td>{p.compaction_coeff.toFixed(3)}</td>
                  </>
                ) : (
                  <>
                    <td>
                      <input
                        className="compaction-table__input"
                        defaultValue={p.density.toFixed(0)}
                        key={`${p.lithology_code}-density-${p.density}`}
                        onBlur={(e) => void handleParamBlur(p.lithology_code, 'density', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="compaction-table__input"
                        defaultValue={p.porosity_surface.toFixed(3)}
                        key={`${p.lithology_code}-phi-${p.porosity_surface}`}
                        onBlur={(e) => void handleParamBlur(p.lithology_code, 'porosity_surface', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="compaction-table__input"
                        defaultValue={p.compaction_coeff.toFixed(3)}
                        key={`${p.lithology_code}-c-${p.compaction_coeff}`}
                        onBlur={(e) => void handleParamBlur(p.lithology_code, 'compaction_coeff', e.target.value)}
                      />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
