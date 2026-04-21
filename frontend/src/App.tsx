import { useEffect, useRef } from 'react'

import { DataManagerPane, ProjectToolbar, StatusBar, ViewerWorkspace } from '@/components'
import { useSidebarResize } from '@/hooks'
import {
  useProjectStore,
  useViewStore,
  useWellDataStore,
  useWorkspaceStore,
} from '@/stores'

function App() {
  const loadWell = useWellDataStore((state) => state.loadWell)
  const loadWellInventories = useWellDataStore((state) => state.loadWellInventories)
  const resetWell = useWellDataStore((state) => state.reset)
  const loadStratCharts = useWellDataStore((state) => state.loadStratCharts)
  const colorOverrides = useWellDataStore((state) => state.colorOverrides)
  const well = useWellDataStore((state) => state.well)

  const isProjectOpen = useProjectStore((state) => state.isOpen)
  const projectPath = useProjectStore((state) => state.projectPath)
  const pollStatus = useProjectStore((state) => state.pollStatus)
  const loadVisualConfig = useProjectStore((state) => state.loadVisualConfig)
  const saveVisualConfig = useProjectStore((state) => state.saveVisualConfig)

  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const selectTrack = useViewStore((state) => state.selectTrack)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const resetVisualConfig = useViewStore((state) => state.resetVisualConfig)

  const formations = useWellDataStore((state) => state.formations)
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace)
  const ensureWellViewState = useWorkspaceStore((state) => state.ensureWellViewState)
  const wellInventories = useWellDataStore((state) => state.wellInventories)

  const configHydratedRef = useRef(false)
  const lastProjectPathRef = useRef<string | null>(null)

  const { workspaceRef, sidebarRef, startWidthDrag, startSplitDrag } = useSidebarResize()

  useEffect(() => {
    void pollStatus()
    const timer = window.setInterval(() => void pollStatus(), 2000)
    return () => window.clearInterval(timer)
  }, [pollStatus])

  useEffect(() => {
    if (!isProjectOpen) {
      configHydratedRef.current = false
      resetWell()
      resetVisualConfig()
      selectTrack(null)
      resetWorkspace()
      return
    }

    let cancelled = false
    const hydrate = async () => {
      try {
        await loadVisualConfig()
      } catch {
        if (!cancelled) resetVisualConfig()
      } finally {
        if (!cancelled) configHydratedRef.current = true
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [isProjectOpen, loadVisualConfig, resetVisualConfig, resetWell, resetWorkspace, selectTrack])

  useEffect(() => {
    if (!isProjectOpen) return
    void loadStratCharts()
  }, [isProjectOpen, loadStratCharts])

  useEffect(() => {
    if (!isProjectOpen || !configHydratedRef.current) return
    const timer = window.setTimeout(() => {
      void saveVisualConfig({ depthPerPixel, trackWidths, curveColors: colorOverrides })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [colorOverrides, depthPerPixel, isProjectOpen, saveVisualConfig, trackWidths])

  useEffect(() => {
    if (!isProjectOpen) {
      lastProjectPathRef.current = null
      resetWell()
      return
    }

    let cancelled = false
    const loadCurrentProject = async () => {
      try {
        const projectChanged = lastProjectPathRef.current !== projectPath
        await loadWellInventories()
        const wells = useWellDataStore.getState().wellInventories
        if (cancelled) return
        lastProjectPathRef.current = projectPath
        if (wells.length === 0) { resetWell(); return }

        const currentWellId = well?.well_id
        const hasCurrent = !projectChanged && currentWellId ? wells.some((w) => w.well_id === currentWellId) : false
        const nextWellId = hasCurrent && currentWellId ? currentWellId : wells[0].well_id
        if (projectChanged) { selectTrack(null); setSelectedFormationId(null) }
        if (nextWellId && (projectChanged || nextWellId !== currentWellId || !well)) {
          await loadWell(nextWellId)
        }
      } catch {
        if (!cancelled) resetWell()
      }
    }
    void loadCurrentProject()
    return () => { cancelled = true }
  }, [isProjectOpen, projectPath, loadWell, loadWellInventories, resetWell, selectTrack, well, setSelectedFormationId])

  useEffect(() => {
    if (selectedFormationId && !formations.some((f) => f.id === selectedFormationId)) {
      setSelectedFormationId(null)
    }
  }, [formations, selectedFormationId, setSelectedFormationId])

  useEffect(() => {
    if (!well?.well_id) {
      selectTrack(null)
      setSelectedFormationId(null)
      setSelectedObject(null)
      return
    }
    ensureWellViewState(well.well_id)
    selectTrack(null)
    setSelectedFormationId(null)
    setSelectedObject({ type: 'well', wellId: well.well_id })
  }, [ensureWellViewState, selectTrack, well?.well_id, setSelectedFormationId, setSelectedObject])

  useEffect(() => {
    if (wellInventories.length === 0) return
    wellInventories.forEach((inventory) => ensureWellViewState(inventory.well_id))
  }, [ensureWellViewState, wellInventories])

  return (
    <div className="app-layout">
      <ProjectToolbar />
      <StatusBar />
      <main className={isProjectOpen ? 'app-main' : 'app-main app-main--gated'}>
        {isProjectOpen ? (
          <div ref={workspaceRef} className="app-workspace">
            <DataManagerPane
              sidebarRef={sidebarRef}
              onInternalSplitterMouseDown={startSplitDrag}
            />
            <div
              className="app-workspace__splitter"
              onMouseDown={startWidthDrag}
            />
            <ViewerWorkspace />
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
