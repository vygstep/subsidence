import { createContext, useContext, useState } from 'react'

interface DataManagerContextValue {
  isExpanded: (nodeId: string) => boolean
  toggleExpanded: (nodeId: string) => void
  setExpanded: (nodeId: string, expanded: boolean) => void
}

const DataManagerContext = createContext<DataManagerContextValue>({
  isExpanded: () => false,
  toggleExpanded: () => {},
  setExpanded: () => {},
})

export function DataManagerProvider({ children }: { children: React.ReactNode }) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  function isExpanded(nodeId: string): boolean {
    return expandedNodes[nodeId] ?? false
  }

  function toggleExpanded(nodeId: string): void {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !(prev[nodeId] ?? false) }))
  }

  function setExpanded(nodeId: string, value: boolean): void {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: value }))
  }

  return (
    <DataManagerContext.Provider value={{ isExpanded, toggleExpanded, setExpanded }}>
      {children}
    </DataManagerContext.Provider>
  )
}

export function useDataManager(): DataManagerContextValue {
  return useContext(DataManagerContext)
}
