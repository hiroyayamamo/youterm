import type { TabsState } from '../shared/types'
import { INITIAL_TABS_STATE } from '../shared/types'
import { transitionTabs, type TabsAction } from './tabs'
import type { PtyHandle } from './pty'
import type { TabsStore } from './tabsStore'

export type CloseResult = 'closed' | 'cancelled' | 'close-window'

export interface TabsControllerDeps {
  spawnPty: (tabId: string) => PtyHandle
  hasChildren: (tabId: string) => Promise<boolean>
  onDialogConfirm: () => Promise<boolean>
  onData: (tabId: string, data: string) => void
  store?: TabsStore
  debounceMs?: number
}

export interface TabsController {
  getState(): TabsState
  newTab(): void
  closeTab(tabId: string): Promise<CloseResult>
  activateTab(tabId: string): void
  renameTab(tabId: string, name: string | null): void
  write(tabId: string, data: string): void
  resize(tabId: string, cols: number, rows: number): void
  subscribe(cb: (s: TabsState) => void): () => void
  disposeAll(): void
}

export function createTabsController(deps: TabsControllerDeps): TabsController {
  const debounceMs = deps.debounceMs ?? 200
  let state: TabsState = deps.store ? deps.store.load() : INITIAL_TABS_STATE
  // Ensure nextId bumps past the maximum existing numeric id
  const maxNumericId = state.tabs.reduce((acc, t) => {
    const n = Number(t.id)
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  let nextId = maxNumericId + 1
  if (nextId < 2) nextId = 2
  const ptys = new Map<string, PtyHandle>()
  const subs = new Set<(s: TabsState) => void>()
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const spawnFor = (tabId: string) => {
    const pty = deps.spawnPty(tabId)
    pty.onData(data => deps.onData(tabId, data))
    ptys.set(tabId, pty)
  }

  for (const t of state.tabs) spawnFor(t.id)

  const scheduleSave = () => {
    if (!deps.store) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      deps.store!.save(state)
    }, debounceMs)
  }

  const apply = (action: TabsAction) => {
    const next = transitionTabs(state, action)
    if (next === state) return
    state = next
    for (const cb of subs) cb(state)
    scheduleSave()
  }

  return {
    getState: () => state,
    newTab() {
      const id = String(nextId++)
      spawnFor(id)
      apply({ type: 'new-tab', id })
    },
    async closeTab(tabId: string): Promise<CloseResult> {
      if (state.tabs.length === 1 && state.tabs[0].id === tabId) {
        return 'close-window'
      }
      const hasChild = await deps.hasChildren(tabId)
      if (hasChild) {
        const ok = await deps.onDialogConfirm()
        if (!ok) return 'cancelled'
      }
      const pty = ptys.get(tabId)
      if (pty) {
        pty.kill()
        ptys.delete(tabId)
      }
      apply({ type: 'close-tab', id: tabId })
      return 'closed'
    },
    activateTab(tabId: string) {
      apply({ type: 'activate-tab', id: tabId })
    },
    renameTab(tabId: string, name: string | null) {
      apply({ type: 'rename-tab', id: tabId, name })
    },
    write(tabId: string, data: string) {
      ptys.get(tabId)?.write(data)
    },
    resize(tabId: string, cols: number, rows: number) {
      ptys.get(tabId)?.resize(cols, rows)
    },
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    disposeAll() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
      for (const pty of ptys.values()) pty.kill()
      ptys.clear()
    },
  }
}
