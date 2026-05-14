import type { ImportWizardStep } from './types'
import type { ColumnMapping } from './mapping'
import type { TabularPreviewResponse } from './types'

const DEFAULT_STEP_LABELS = ['File', 'Preview']

export function buildImportWizardSteps(
  currentStepIndex: number,
  sourceIsValid: boolean,
  labels: string[] = DEFAULT_STEP_LABELS,
): ImportWizardStep[] {
  return labels.map((label, index) => {
    let status: ImportWizardStep['status'] = 'active'
    if (index < currentStepIndex) {
      status = 'done'
    } else if (index > currentStepIndex) {
      status = 'blocked'
    }
    if (index > 0 && !sourceIsValid) {
      status = 'blocked'
    }
    return {
      id: label.toLowerCase(),
      label,
      status,
    }
  })
}

export async function readImportError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) {
      return payload.detail
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback
}

export function distinctMappedValues(
  preview: TabularPreviewResponse | null,
  mapping: ColumnMapping,
  fieldId: string,
): string[] {
  const column = mapping[fieldId]
  if (!preview || !column) return []
  const columnIndex = preview.columns.indexOf(column)
  if (columnIndex < 0) return []
  const values = new Set<string>()
  for (const row of preview.rows) {
    const value = (row[columnIndex] ?? '').trim()
    if (value) values.add(value)
  }
  return [...values].sort((a, b) => a.localeCompare(b))
}
