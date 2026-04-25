import type { ImportWizardStep } from './types'

const STEP_LABELS = ['File', 'Options', 'Import']

export function buildImportWizardSteps(currentStepIndex: number, sourceIsValid: boolean): ImportWizardStep[] {
  return STEP_LABELS.map((label, index) => {
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
