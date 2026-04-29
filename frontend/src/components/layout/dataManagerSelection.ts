import type { Well } from '@/types'
import type { SelectedObject, ToolbarMode } from '@/stores/workspaceStore'

interface SelectionDeps {
  well: Well | null
  selectedObject: SelectedObject | null
  setSelectedObject: (obj: SelectedObject | null) => void
  setSelectedFormationId: (id: string | null) => void
  setActiveToolbarMode: (mode: ToolbarMode) => void
  loadWell: (wellId: string) => Promise<void>
}

export function makeSelectionHandlers(deps: SelectionDeps) {
  const { well, selectedObject, setSelectedObject, setSelectedFormationId, setActiveToolbarMode, loadWell } = deps

  function loadWellInBackground(wellId: string): void {
    if (wellId !== well?.well_id) {
      void loadWell(wellId)
    }
  }

  function handleSelectWell(wellId: string): void {
    setSelectedObject({ type: 'well', wellId })
    loadWellInBackground(wellId)
  }

  function handleFocusWellObject(wellId: string): void {
    setSelectedObject({ type: 'well', wellId })
  }

  function handleFocusLasGroupObject(wellId: string): void {
    setSelectedObject({ type: 'las-group', wellId })
  }

  function handleFocusCurveObject(wellId: string, mnemonic: string): void {
    setSelectedObject({ type: 'curve', wellId, mnemonic })
  }

  function handleFocusTopsGroupObject(wellId: string): void {
    setSelectedObject({ type: 'tops-group', wellId })
  }

  function handleSelectZonesGroup(wellId: string): void {
    setSelectedObject({ type: 'zones-group', wellId })
    loadWellInBackground(wellId)
  }

  function handleSelectZone(wellId: string, zoneId: number): void {
    if (selectedObject?.type === 'zone' && selectedObject.wellId === wellId && selectedObject.zoneId === zoneId) {
      setSelectedObject(null)
    } else {
      setSelectedObject({ type: 'zone', wellId, zoneId })
    }
    loadWellInBackground(wellId)
  }

  function handleSelectZoneSetsRoot(): void {
    setSelectedObject({ type: 'zone-sets-root' })
  }

  function handleSelectZoneSet(zoneSetId: number, wellId: string): void {
    setSelectedObject({ type: 'zone-set', zoneSetId, wellId })
    loadWellInBackground(wellId)
  }

  function handleSelectZoneInSet(zoneSetId: number, wellId: string, zoneId: number): void {
    if (
      selectedObject?.type === 'zone'
      && selectedObject.wellId === wellId
      && selectedObject.zoneId === zoneId
      && selectedObject.zoneSetId === zoneSetId
    ) {
      setSelectedObject(null)
    } else {
      setSelectedObject({ type: 'zone', zoneSetId, wellId, zoneId })
    }
    loadWellInBackground(wellId)
  }

  async function handleSelectLasGroup(wellId: string): Promise<void> {
    setSelectedObject({ type: 'las-group', wellId })
    loadWellInBackground(wellId)
  }

  async function handleSelectCurve(wellId: string, mnemonic: string): Promise<void> {
    if (selectedObject?.type === 'curve' && selectedObject.wellId === wellId && selectedObject.mnemonic === mnemonic) {
      setSelectedObject(null)
    } else {
      setSelectedObject({ type: 'curve', wellId, mnemonic })
    }
    loadWellInBackground(wellId)
  }

  async function handleSelectTopsGroup(wellId: string): Promise<void> {
    setSelectedObject({ type: 'tops-group', wellId })
    loadWellInBackground(wellId)
  }

  async function handleSelectFormation(wellId: string, formationId: string): Promise<void> {
    if (selectedObject?.type === 'top-pick' && selectedObject.wellId === wellId && selectedObject.formationId === formationId) {
      setSelectedObject(null)
      setSelectedFormationId(null)
    } else {
      setSelectedFormationId(formationId)
      setSelectedObject({ type: 'top-pick', wellId, formationId })
      setActiveToolbarMode('tops')
    }
    loadWellInBackground(wellId)
  }

  function handleFocusFormationObject(wellId: string, formationId: string): void {
    setSelectedFormationId(formationId)
    setSelectedObject({ type: 'top-pick', wellId, formationId })
  }

  return {
    handleSelectWell,
    handleFocusWellObject,
    handleFocusLasGroupObject,
    handleFocusCurveObject,
    handleFocusTopsGroupObject,
    handleSelectLasGroup,
    handleSelectCurve,
    handleSelectTopsGroup,
    handleSelectFormation,
    handleFocusFormationObject,
    handleSelectZonesGroup,
    handleSelectZone,
    handleSelectZoneSetsRoot,
    handleSelectZoneSet,
    handleSelectZoneInSet,
  }
}
