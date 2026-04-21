import { useEffect, useRef, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage: (data: unknown) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

const MAX_BACKOFF_MS = 30_000

export function useWebSocket(options: UseWebSocketOptions): {
  send: (data: unknown) => void
  readyState: number
} {
  const { url, onMessage, onConnect, onDisconnect } = options
  const wsRef = useRef<WebSocket | null>(null)
  const readyStateRef = useRef<number>(WebSocket.CLOSED)
  const queueRef = useRef<string[]>([])
  const backoffRef = useRef(1_000)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const callbacksRef = useRef({ onMessage, onConnect, onDisconnect })
  callbacksRef.current = { onMessage, onConnect, onDisconnect }

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      readyStateRef.current = WebSocket.OPEN
      backoffRef.current = 1_000
      callbacksRef.current.onConnect?.()
      for (const msg of queueRef.current) ws.send(msg)
      queueRef.current = []
    }

    ws.onmessage = (event) => {
      try {
        callbacksRef.current.onMessage(JSON.parse(event.data as string))
      } catch {
        callbacksRef.current.onMessage(event.data)
      }
    }

    ws.onclose = () => {
      readyStateRef.current = WebSocket.CLOSED
      callbacksRef.current.onDisconnect?.()
      if (!mountedRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
        connect()
      }, backoffRef.current)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: unknown) => {
    const msg = JSON.stringify(data)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg)
    } else {
      queueRef.current.push(msg)
    }
  }, [])

  return { send, readyState: readyStateRef.current }
}
