import { create } from 'zustand'

export type TabId = 'shelf' | 'build' | 'ideas' | 'saved'

interface NavState {
  tab: TabId
  go: (tab: TabId) => void
}

/** Which bottom tab is showing, so one screen can send the user to another. */
export const useNav = create<NavState>((set) => ({
  tab: 'shelf',
  go: (tab) => set({ tab }),
}))
