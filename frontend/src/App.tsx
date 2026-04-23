import { useEffect, useRef } from 'react'

import { DataManagerPane, ProjectToolbar, StatusBar, ViewerWorkspace } from '@/components'
import { useKeyboardShortcuts, useSidebarResize } from '@/hooks'
import {
  collectProjectVisualConfig,
  coerceWellViewState,
  createDefaultWellView,
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
  const loadCompactionModels = useWellDataStore((state) => state.loadCompactionModels)
  const loadCompactionPresets = useWellDataStore((state) => state.loadCompactionPresets)
  const loadCurveDictionary = useWellDataStore((state) => state.loadCurveDictionary)
  const loadLithologyDictionary = useWellDataStore((state) => state.loadLithologyDictionary)
  const colorOverrides = useWellDataStore((state) => state.colorOverrides)
  const well = useWellDataStore((state) => state.well)

  const isProjectOpen = useProjectStore((state) => state.isOpen)
  const projectPath = useProjectStore((state) => state.projectPath)
  const pollStatus = useProjectStore((state) => state.pollStatus)
  const loadScopedVisualConfig = useProjectStore((state) => state.loadScopedVisualConfig)
  const markVisualConfigDirty = useProjectStore((state) => state.markVisualConfigDirty)
  const clearVisualConfigDirty = useProjectStore((state) => state.clearVisualConfigDirty)
  const visualConfigSaveToken = useProjectStore((state) => state.visualConfigSaveToken)

  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const selectTrack = useViewStore((state) => state.selectTrack)
  const selectedElementId = useViewStore((state) => state.selectedElementId)
  const selectedElementType = useViewStore((state) => state.selectedElementType)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const applyActiveWellTrackWidths = useViewStore((state) => state.applyActiveWellTrackWidths)
  const resetVisualConfig = useViewStore((state) => state.resetVisualConfig)

  const formations = useWellDataStore((state) => state.formations)
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace)
  const ensureWellViewState = useWorkspaceStore((state) => state.ensureWellViewState)
  const replaceWellViewStates = useWorkspaceStore((state) => state.replaceWellViewStates)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const wellInventories = useWellDataStore((state) => state.wellInventories)

  const configHydratedRef = useRef(false)
  const wellViewsHydratedRef = useRef(false)
  const lastProjectPathRef = useRef<string | null>(null)
  const lastSerializedProjectVisualConfigRef = useRef<string>('')
  const lastSerializedWellViewsRef = useRef<Record<string, string>>({})

  const { workspaceRef, sidebarRef, startWidthDrag, startSplitDrag } = useSidebarResize()

  useEffect(() => {
    void pollStatus()
    if (!isProjectOpen) {
      return
    }
    const timer = window.setInterval(() => void pollStatus(), 10_000)
    return () => window.clearInterval(timer)
  }, [isProjectOpen, pollStatus])

  useKeyboardShortcuts()

  useEffect(() => {
    if (!selectedElementId || !selectedElementType) return
    const wellId = well?.well_id
    if (!wellId) return
    if (selectedElementType === 'curve') {
      setSelectedObject({ type: 'curve', wellId, mnemonic: selectedElementId })
    } else if (selectedElementType === 'formation') {
      setSelectedObject({ type: 'top-pick', wellId, formationId: selectedElementId })
      setSelectedFormationId(selectedElementId)
    } else if (selectedElementType === 'track' && selectedElementId === 'depth') {
      setSelectedObject({ type: 'depth-track', wellId })
    } else if (selectedElementType === 'track' && selectedElementId === 'formations') {
      setSelectedObject({ type: 'formations-track', wellId })
    }
  }, [selectedElementId, selectedElementType, well?.well_id, setSelectedObject, setSelectedFormationId])

  useEffect(() => {
    if (!isProjectOpen) {
      configHydratedRef.current = false
      wellViewsHydratedRef.current = false
      lastSerializedProjectVisualConfigRef.current = ''
      lastSerializedWellViewsRef.current = {}
      resetWell()
      resetVisualConfig()
      selectTrack(null)
      resetWorkspace()
      return
    }

    let cancelled = false
    const hydrate = async () => {
      try {
        await loadScopedVisualConfig('project')
        if (!cancelled) {
          lastSerializedProjectVisualConfigRef.current = JSON.stringify(collectProjectVisualConfig())
        }
      } catch {
        if (!cancelled) resetVisualConfig()
      } finally {
        if (!cancelled) configHydratedRef.current = true
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [isProjectOpen, loadScopedVisualConfig, resetVisualConfig, resetWell, resetWorkspace, selectTrack])

  useEffect(() => {
    if (!isProjectOpen) return
    void loadStratCharts()
  }, [isProjectOpen, loadStratCharts])

  useEffect(() => {
    if (!isProjectOpen) return
    void loadCompactionModels()
    void loadCompactionPresets()
  }, [isProjectOpen, loadCompactionModels, loadCompactionPresets])

  useEffect(() => {
    if (!isProjectOpen) return
    void loadCurveDictionary()
    void loadLithologyDictionary()
  }, [isProjectOpen, loadCurveDictionary, loadLithologyDictionary])

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
        const inventoriesLoaded = await loadWellInventories()
        if (!inventoriesLoaded || cancelled) {
          return
        }
        const wells = useWellDataStore.getState().wellInventories
        lastProjectPathRef.current = projectPath
        if (wells.length === 0) {
          replaceWellViewStates({})
          wellViewsHydratedRef.current = true
          lastSerializedWellViewsRef.current = {}
          resetWell()
          return
        }

        const viewEntries = await Promise.all(
          wells.map(async (entry) => {
            const rawConfig = await loadScopedVisualConfig('well', entry.well_id)
            return [entry.well_id, coerceWellViewState(rawConfig)] as const
          }),
        )
        if (cancelled) return
        const nextWellViews = Object.fromEntries(viewEntries)
        replaceWellViewStates(nextWellViews)
        lastSerializedProjectVisualConfigRef.current = JSON.stringify(collectProjectVisualConfig())
        lastSerializedWellViewsRef.current = Object.fromEntries(
          Object.entries(nextWellViews).map(([wellId, state]) => [wellId, JSON.stringify(state)]),
        )
        wellViewsHydratedRef.current = true

        const currentWell = useWellDataStore.getState().well
        const currentWellId = currentWell?.well_id
        const hasCurrent = !projectChanged && currentWellId ? wells.some((w) => w.well_id === currentWellId) : false
        const nextWellId = hasCurrent && currentWellId ? currentWellId : wells[0].well_id
        if (projectChanged) { selectTrack(null); setSelectedFormationId(null) }
        // Hydrate per-project visual state only on project-open cycles. Re-running
        // this effect on every current-well refresh would overwrite unsaved local
        // track/tops visibility drafts with the last saved backend snapshot.
        if (nextWellId && (projectChanged || nextWellId !== currentWellId || !currentWell)) {
          await loadWell(nextWellId)
        }
      } catch {
        if (!cancelled) resetWell()
      }
    }
    void loadCurrentProject()
    return () => { cancelled = true }
  }, [isProjectOpen, projectPath, loadScopedVisualConfig, loadWell, loadWellInventories, replaceWellViewStates, resetWell, selectTrack, setSelectedFormationId])

  useEffect(() => {
    if (selectedFormationId && !formations.some((f) => f.id === selectedFormationId)) {
      setSelectedFormationId(null)
    }
  }, [formations, selectedFormationId, setSelectedFormationId])

  useEffect(() => {
    if (!well?.well_id) {
      applyActiveWellTrackWidths({})
      selectTrack(null)
      setSelectedFormationId(null)
      setSelectedObject(null)
      return
    }
    ensureWellViewState(well.well_id)
    selectTrack(null)
    setSelectedFormationId(null)
    setSelectedObject({ type: 'well', wellId: well.well_id })
  }, [applyActiveWellTrackWidths, ensureWellViewState, selectTrack, well?.well_id, setSelectedFormationId, setSelectedObject])

  useEffect(() => {
    if (wellInventories.length === 0) return
    wellInventories.forEach((inventory) => ensureWellViewState(inventory.well_id))
  }, [ensureWellViewState, wellInventories])

  useEffect(() => {
    if (!well?.well_id) {
      applyActiveWellTrackWidths({})
      return
    }
    const activeWellView = wellViewStates[well.well_id] ?? createDefaultWellView()
    applyActiveWellTrackWidths(
      Object.fromEntries(activeWellView.tracks.map((track) => [track.id, track.width])),
    )
  }, [applyActiveWellTrackWidths, well?.well_id, wellViewStates])

  useEffect(() => {
    if (!isProjectOpen || !configHydratedRef.current || !wellViewsHydratedRef.current) return

    const projectChanged = lastSerializedProjectVisualConfigRef.current !== JSON.stringify(collectProjectVisualConfig())
    const currentWellIds = new Set(Object.keys(wellViewStates))
    const baselineWellIds = new Set(Object.keys(lastSerializedWellViewsRef.current))
    const wellViewsChanged = (
      Object.entries(wellViewStates).some(([wellId, state]) => lastSerializedWellViewsRef.current[wellId] !== JSON.stringify(state))
      || Array.from(baselineWellIds).some((wellId) => !currentWellIds.has(wellId))
    )

    if (projectChanged || wellViewsChanged) {
      markVisualConfigDirty()
    } else {
      clearVisualConfigDirty()
    }
  }, [
    clearVisualConfigDirty,
    colorOverrides,
    configHydratedRef,
    depthPerPixel,
    isProjectOpen,
    markVisualConfigDirty,
    trackWidths,
    wellViewStates,
  ])

  useEffect(() => {
    if (!isProjectOpen || visualConfigSaveToken === 0) return
    lastSerializedProjectVisualConfigRef.current = JSON.stringify(collectProjectVisualConfig())
    lastSerializedWellViewsRef.current = Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [wellId, JSON.stringify(state)]),
    )
    clearVisualConfigDirty()
  }, [clearVisualConfigDirty, isProjectOpen, visualConfigSaveToken, wellViewStates])

  return (
    <div className="app-layout">
      <ProjectToolbar />
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
      <StatusBar />
    </div>
  )
}

export default App
