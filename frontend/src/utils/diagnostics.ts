export type DiagnosticLevel = 'info' | 'warn' | 'error'
export type DiagnosticPhase = 'start' | 'success' | 'failure' | 'event'

export interface DiagnosticEvent {
  timestamp: string
  level: DiagnosticLevel
  operation: string
  phase: DiagnosticPhase
  durationMs?: number
  projectPath?: string | null
  activeWellId?: string | null
  selectedObject?: string | null
  message?: string
  error?: string
  details?: Record<string, unknown>
}

export interface DiagnosticSnapshot {
  generatedAt: string
  app: {
    name: 'SUBSIDENCE'
    location: string
    userAgent: string
  }
  context: Record<string, unknown>
  events: DiagnosticEvent[]
}

const MAX_EVENTS = 250
const events: DiagnosticEvent[] = []

function pushEvent(event: DiagnosticEvent): void {
  events.push(event)
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS)
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function logDiagnosticEvent(event: Omit<DiagnosticEvent, 'timestamp'>): void {
  pushEvent({
    timestamp: new Date().toISOString(),
    ...event,
  })
}

export async function recordOperation<T>(
  operation: string,
  work: () => Promise<T>,
  context: Omit<DiagnosticEvent, 'timestamp' | 'level' | 'operation' | 'phase' | 'durationMs' | 'error'> = {},
): Promise<T> {
  const start = performance.now()
  logDiagnosticEvent({
    level: 'info',
    operation,
    phase: 'start',
    ...context,
  })

  try {
    const result = await work()
    logDiagnosticEvent({
      level: 'info',
      operation,
      phase: 'success',
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      ...context,
    })
    return result
  } catch (error) {
    logDiagnosticEvent({
      level: 'error',
      operation,
      phase: 'failure',
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      error: normalizeError(error),
      ...context,
    })
    throw error
  }
}

export function readDiagnosticEvents(): DiagnosticEvent[] {
  return [...events]
}

export function clearDiagnosticEvents(): void {
  events.length = 0
}

export function buildDiagnosticSnapshot(context: Record<string, unknown> = {}): DiagnosticSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    app: {
      name: 'SUBSIDENCE',
      location: window.location.href,
      userAgent: navigator.userAgent,
    },
    context,
    events: readDiagnosticEvents(),
  }
}
