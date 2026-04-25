import type { ImportWizardStep } from './types'

export const DEFAULT_STEP_LABELS = ['File', 'Preview', 'Options', 'Import']
export const MAPPING_STEP_LABELS = ['File', 'Preview', 'Mapping', 'Options', 'Import']

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
