import type { Tab, TabsState } from '../shared/types'

export type TabsAction =
  | { type: 'new-tab'; id: string }
  | { type: 'close-tab'; id: string }
  | { type: 'activate-tab'; id: string }
  | { type: 'rename-tab'; id: string; name: string | null }
  | { type: 'set-tab-cwds'; cwds: Record<string, string> }
  | { type: 'move-tab'; id: string; beforeId: string | null }

export function transitionTabs(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'new-tab': {
      const newTab: Tab = { id: action.id, customName: null, cwd: null }
      return {
        tabs: [...state.tabs, newTab],
        activeId: action.id,
      }
    }
    case 'close-tab': {
      const idx = state.tabs.findIndex(t => t.id === action.id)
      if (idx < 0) return state
      if (state.tabs.length === 1) return state
      const nextTabs = state.tabs.filter(t => t.id !== action.id)
      let nextActive = state.activeId
      if (state.activeId === action.id) {
        nextActive = idx > 0 ? state.tabs[idx - 1].id : state.tabs[idx + 1].id
      }
      return { tabs: nextTabs, activeId: nextActive }
    }
    case 'activate-tab': {
      if (!state.tabs.some(t => t.id === action.id)) return state
      if (state.activeId === action.id) return state
      return { ...state, activeId: action.id }
    }
    case 'rename-tab': {
      const idx = state.tabs.findIndex(t => t.id === action.id)
      if (idx < 0) return state
      if (state.tabs[idx].customName === action.name) return state
      const nextTabs = state.tabs.map(t =>
        t.id === action.id ? { ...t, customName: action.name } : t,
      )
      return { ...state, tabs: nextTabs }
    }
    case 'set-tab-cwds': {
      let changed = false
      const updated = state.tabs.map(t => {
        const next = action.cwds[t.id]
        if (next === undefined) return t
        if (next === t.cwd) return t
        changed = true
        return { ...t, cwd: next }
      })
      if (!changed) return state
      return { ...state, tabs: updated }
    }
    case 'move-tab': {
      const fromIdx = state.tabs.findIndex(t => t.id === action.id)
      if (fromIdx < 0) return state
      if (action.beforeId === action.id) return state
      const next = [...state.tabs]
      const [tab] = next.splice(fromIdx, 1)
      if (action.beforeId === null) {
        next.push(tab)
      } else {
        const targetIdx = next.findIndex(t => t.id === action.beforeId)
        if (targetIdx < 0) return state
        next.splice(targetIdx, 0, tab)
      }
      // Skip re-emit when the order didn't actually change (e.g. moving the
      // last tab to "end" or dropping it just before its current neighbor).
      if (next.every((t, i) => t === state.tabs[i])) return state
      return { ...state, tabs: next }
    }
  }
}
