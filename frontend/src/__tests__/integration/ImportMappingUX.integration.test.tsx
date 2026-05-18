import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TabularPreviewPane } from '@/components/layout/importWizard/TabularPreviewPane'
import type { ColumnMapping, FieldDefinition } from '@/components/layout/importWizard/mapping'

const fields: FieldDefinition[] = [
  { id: 'depth', label: 'MD', required: true, aliases: ['md'] },
  { id: 'well_name', label: 'Well name', required: false, aliases: ['well'] },
]

function MappingHarness() {
  const [mapping, setMapping] = useState<ColumnMapping>({ depth: 'MD', well_name: null })

  return (
    <TabularPreviewPane
      isLoading={false}
      error={null}
      preview={{
        columns: ['MD', 'DEPTH_M'],
        rows: [['100', '100'], ['101', '101']],
        detected_delimiter: ',',
        header_row: 0,
        total_rows: 2,
        warnings: [],
      }}
      settings={{ delimiter: ',', headerRow: 0 }}
      onSettingsChange={vi.fn()}
      fields={fields}
      mapping={mapping}
      onMappingChange={(fieldId, colName) => setMapping((prev) => ({ ...prev, [fieldId]: colName }))}
    />
  )
}

describe('Import mapping UX', () => {
  it('reassigns a mapped field to another column without manual clearing', () => {
    render(<MappingHarness />)

    const headerRows = screen.getAllByRole('row')
    const mappingSelects = within(headerRows[0]).getAllByRole('combobox')

    expect((mappingSelects[0] as HTMLSelectElement).value).toBe('depth')
    expect((mappingSelects[1] as HTMLSelectElement).value).toBe('')

    fireEvent.change(mappingSelects[1], { target: { value: 'depth' } })

    expect((mappingSelects[0] as HTMLSelectElement).value).toBe('')
    expect((mappingSelects[1] as HTMLSelectElement).value).toBe('depth')
  })

  it('shows log curve mnemonics for unmapped curve columns', () => {
    render(
      <TabularPreviewPane
        isLoading={false}
        error={null}
        preview={{
          columns: ['MD', 'GR', 'RHOB [g/cc]'],
          rows: [['100', '80', '2.4']],
          detected_delimiter: ',',
          header_row: 0,
          total_rows: 1,
          warnings: [],
        }}
        settings={{ delimiter: ',', headerRow: 0 }}
        onSettingsChange={vi.fn()}
        fields={fields}
        mapping={{ depth: 'MD', well_name: null }}
        onMappingChange={vi.fn()}
        unmappedColumnLabels={{ GR: 'GR', 'RHOB [g/cc]': 'RHOB' }}
      />,
    )

    const mappingSelects = within(screen.getAllByRole('row')[0]).getAllByRole('combobox') as HTMLSelectElement[]

    expect(mappingSelects[0].selectedOptions[0].textContent).toBe('MD *')
    expect(mappingSelects[1].selectedOptions[0].textContent).toBe('GR')
    expect(mappingSelects[2].selectedOptions[0].textContent).toBe('RHOB')
  })
})
