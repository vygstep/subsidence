import { create } from 'zustand'

interface NotificationState {
  qcWarnings: string[]
  isQcPanelOpen: boolean
  addQcWarnings: (warnings: string[]) => void
  clearQcWarnings: () => void
  toggleQcPanel: () => void
  closeQcPanel: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  qcWarnings: [],
  isQcPanelOpen: false,
  addQcWarnings: (warnings) => set((state) => ({
    qcWarnings: [...state.qcWarnings, ...warnings],
    isQcPanelOpen: warnings.length > 0 ? true : state.isQcPanelOpen,
  })),
  clearQcWarnings: () => set({ qcWarnings: [], isQcPanelOpen: false }),
  toggleQcPanel: () => set((state) => ({ isQcPanelOpen: !state.isQcPanelOpen })),
  closeQcPanel: () => set({ isQcPanelOpen: false }),
}))
