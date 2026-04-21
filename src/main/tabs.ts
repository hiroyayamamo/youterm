import type { Pane, Tab, TabsState } from '../shared/types'

export type TabsAction =
  | { type: 'new-tab'; id: string }
  | { type: 'close-tab'; id: string }
  | { type: 'activate-tab'; id: string }
  | { type: 'rename-tab'; id: string; name: string | null }
  | { type: 'set-tab-cwds'; cwds: Record<string, string> }
  | { type: 'move-tab'; id: string; beforeId: string | null }
  | { type: 'split-panes'; newTabId: string }
  | { type: 'unsplit-panes' }
  | { type: 'activate-pane'; index: 0 | 1 }
  | { type: 'set-split-ratio'; ratio: number }
  | { type: 'move-tab-to-pane'; id: string; paneIndex: 0 | 1; beforeId: string | null }

// --- helpers -----------------------------------------------------------

/** Find (paneIndex, tabIndex) of a tab id, or null if not present. */
function locateTab(state: TabsState, id: string): { p: number; t: number } | null {
  for (let p = 0; p < state.panes.length; p++) {
    const t = state.panes[p].tabs.findIndex(x => x.id === id)
    if (t >= 0) return { p, t }
  }
  return null
}

/** Replace one pane at index with a new pane object. */
function replacePane(state: TabsState, index: number, pane: Pane): TabsState {
  const panes = state.panes.slice()
  panes[index] = pane
  return { ...state, panes }
}

/**
 * If the pane at `index` is empty and the state is currently split (length 2),
 * collapse back to a single pane containing the other pane's tabs. Otherwise
 * return state unchanged.
 */
function collapseIfEmpty(state: TabsState, index: number): TabsState {
  if (state.panes.length !== 2) return state
  if (state.panes[index].tabs.length > 0) return state
  const keep = state.panes[1 - index]
  return {
    panes: [keep],
    activePaneIndex: 0,
    splitRatio: state.splitRatio,
  }
}

// --- reducer -----------------------------------------------------------

export function transitionTabs(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'new-tab': {
      const newTab: Tab = { id: action.id, customName: null, cwd: null }
      const paneIdx = state.activePaneIndex
      const pane = state.panes[paneIdx]
      return replacePane(state, paneIdx, {
        tabs: [...pane.tabs, newTab],
        activeId: action.id,
      })
    }
    case 'close-tab': {
      const loc = locateTab(state, action.id)
      if (!loc) return state
      const pane = state.panes[loc.p]
      // All tabs across all panes — last tab overall keeps state unchanged
      // (window close is the controller's responsibility).
      const totalTabs = state.panes.reduce((n, p) => n + p.tabs.length, 0)
      if (totalTabs <= 1) return state
      const nextTabs = pane.tabs.filter(t => t.id !== action.id)
      let nextActiveId = pane.activeId
      if (pane.activeId === action.id) {
        nextActiveId = loc.t > 0 ? pane.tabs[loc.t - 1].id : pane.tabs[loc.t + 1].id
      }
      const withRemoved = replacePane(state, loc.p, { tabs: nextTabs, activeId: nextActiveId })
      return collapseIfEmpty(withRemoved, loc.p)
    }
    case 'activate-tab': {
      const loc = locateTab(state, action.id)
      if (!loc) return state
      const pane = state.panes[loc.p]
      if (state.activePaneIndex === loc.p && pane.activeId === action.id) return state
      const next = replacePane(state, loc.p, { ...pane, activeId: action.id })
      return { ...next, activePaneIndex: loc.p }
    }
    case 'rename-tab': {
      const loc = locateTab(state, action.id)
      if (!loc) return state
      const pane = state.panes[loc.p]
      if (pane.tabs[loc.t].customName === action.name) return state
      const nextTabs = pane.tabs.map(t =>
        t.id === action.id ? { ...t, customName: action.name } : t,
      )
      return replacePane(state, loc.p, { ...pane, tabs: nextTabs })
    }
    case 'set-tab-cwds': {
      let changed = false
      const nextPanes = state.panes.map(p => {
        const updated = p.tabs.map(t => {
          const next = action.cwds[t.id]
          if (next === undefined) return t
          if (next === t.cwd) return t
          changed = true
          return { ...t, cwd: next }
        })
        return updated === p.tabs ? p : { ...p, tabs: updated }
      })
      if (!changed) return state
      return { ...state, panes: nextPanes }
    }
    case 'split-panes': {
      if (state.panes.length === 2) return state
      const newPane: Pane = {
        tabs: [{ id: action.newTabId, customName: null, cwd: null }],
        activeId: action.newTabId,
      }
      return {
        panes: [state.panes[0], newPane],
        activePaneIndex: 1,
        splitRatio: state.splitRatio,
      }
    }
    case 'unsplit-panes': {
      if (state.panes.length !== 2) return state
      const focused = state.panes[state.activePaneIndex]
      const merged: Pane = {
        tabs: [...state.panes[0].tabs, ...state.panes[1].tabs],
        activeId: focused.activeId,
      }
      return {
        panes: [merged],
        activePaneIndex: 0,
        splitRatio: state.splitRatio,
      }
    }
    case 'activate-pane': {
      if (action.index < 0 || action.index >= state.panes.length) return state
      if (state.activePaneIndex === action.index) return state
      return { ...state, activePaneIndex: action.index }
    }
    case 'set-split-ratio': {
      if (state.panes.length !== 2) return state
      const clamped = Math.max(0.1, Math.min(0.9, action.ratio))
      if (clamped === state.splitRatio) return state
      return { ...state, splitRatio: clamped }
    }
    case 'move-tab-to-pane': {
      const fromLoc = locateTab(state, action.id)
      if (!fromLoc) return state
      if (action.paneIndex < 0 || action.paneIndex >= state.panes.length) return state

      // Same-pane move → delegate to move-tab semantics
      if (fromLoc.p === action.paneIndex) {
        return transitionTabs(state, { type: 'move-tab', id: action.id, beforeId: action.beforeId })
      }

      const sourcePane = state.panes[fromLoc.p]
      const targetPane = state.panes[action.paneIndex]
      const tab = sourcePane.tabs[fromLoc.t]

      // Remove from source
      const sourceTabs = sourcePane.tabs.filter(t => t.id !== action.id)
      let sourceActiveId = sourcePane.activeId
      if (sourcePane.activeId === action.id && sourceTabs.length > 0) {
        sourceActiveId = fromLoc.t > 0 ? sourcePane.tabs[fromLoc.t - 1].id : sourcePane.tabs[fromLoc.t + 1].id
      }

      // Insert into target
      const targetTabs = targetPane.tabs.slice()
      if (action.beforeId === null) {
        targetTabs.push(tab)
      } else {
        const idx = targetTabs.findIndex(t => t.id === action.beforeId)
        if (idx < 0) return state
        targetTabs.splice(idx, 0, tab)
      }

      const panes = state.panes.slice()
      panes[fromLoc.p] = { tabs: sourceTabs, activeId: sourceActiveId }
      panes[action.paneIndex] = { tabs: targetTabs, activeId: action.id }
      const withMoved: TabsState = { ...state, panes, activePaneIndex: action.paneIndex }
      return collapseIfEmpty(withMoved, fromLoc.p)
    }
    case 'move-tab': {
      const fromLoc = locateTab(state, action.id)
      if (!fromLoc) return state
      if (action.beforeId === action.id) return state
      const pane = state.panes[fromLoc.p]
      // move-tab is within the same pane. If beforeId is in a different pane
      // (or null in a split state), treat it as a no-op — caller should use
      // move-tab-to-pane for cross-pane moves.
      if (action.beforeId !== null) {
        const targetLoc = locateTab(state, action.beforeId)
        if (!targetLoc || targetLoc.p !== fromLoc.p) return state
      }
      const tabs = pane.tabs.slice()
      const [tab] = tabs.splice(fromLoc.t, 1)
      if (action.beforeId === null) {
        tabs.push(tab)
      } else {
        const targetIdx = tabs.findIndex(t => t.id === action.beforeId)
        if (targetIdx < 0) return state
        tabs.splice(targetIdx, 0, tab)
      }
      if (tabs.every((t, i) => t === pane.tabs[i])) return state
      return replacePane(state, fromLoc.p, { ...pane, tabs })
    }
  }
}
