// Module-level WebSocket singleton for the /ws/recalculate endpoint.
// computedStore imports sendRecalculation from here; to avoid a circular
// module init cycle this module accesses computedStore via dynamic import
// inside callbacks (never at module load time).

import type { SubsidenceResult } from '@/types/subsidence'

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let backoffMs = 1_000
const MAX_BACKOFF_MS = 30_000
const pendingMessages: string[] = []

function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws/recalculate`
}

function onMessage(event: MessageEvent): void {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(event.data as string) as Record<string, unknown>
  } catch {
    return
  }

  void import('@/stores/computedStore').then(({ useComputedStore }) => {
    if (data.status === 'computing') {
      useComputedStore.setState({ isComputing: true, computeError: null })
    } else if (data.status === 'complete') {
      useComputedStore.getState().setResults(data.results as SubsidenceResult[])
    } else if (data.status === 'error') {
      useComputedStore.setState({
        isComputing: false,
        computeError: (data.message as string) ?? 'Unknown error',
      })
    }
  })
}

function connect(): void {
  if (socket && socket.readyState !== WebSocket.CLOSED) return

  socket = new WebSocket(wsUrl())

  socket.onopen = () => {
    backoffMs = 1_000
    const ws = socket
    if (ws) {
      for (const msg of pendingMessages) ws.send(msg)
      pendingMessages.length = 0
    }
  }

  socket.onmessage = onMessage

  socket.onclose = () => {
    socket = null
    reconnectTimer = setTimeout(() => {
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
      connect()
    }, backoffMs)
  }

  socket.onerror = () => {
    socket?.close()
  }
}

export function ensureConnected(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  connect()
}

export function sendRecalculation(wellId: string): void {
  ensureConnected()
  const msg = JSON.stringify({ well_id: wellId })
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(msg)
  } else {
    // CONNECTING or transiently unavailable — onopen will flush pendingMessages
    pendingMessages.length = 0  // only latest request matters
    pendingMessages.push(msg)
  }
}
