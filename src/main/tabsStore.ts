import type { Tab, TabsState } from '../shared/types'
import { INITIAL_TABS_STATE } from '../shared/types'

export interface TabsStore {
  load(): TabsState
  save(s: TabsState): void
}

function isValidTab(raw: unknown): raw is Tab {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id.length === 0) return false
  if (r.customName !== null && typeof r.customName !== 'string') return false
  // cwd is optional (v0.10 field); null or string are both acceptable. Missing → null.
  if (r.cwd !== undefined && r.cwd !== null && typeof r.cwd !== 'string') return false
  return true
}

export function validateTabsState(raw: unknown): TabsState {
  if (!raw || typeof raw !== 'object') return INITIAL_TABS_STATE
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.tabs) || r.tabs.length === 0) return INITIAL_TABS_STATE
  const tabs: Tab[] = []
  for (const t of r.tabs) {
    if (!isValidTab(t)) return INITIAL_TABS_STATE
    const rawCwd = (t as unknown as { cwd?: unknown }).cwd
    const cwd = typeof rawCwd === 'string' ? rawCwd : null
    tabs.push({ id: t.id, customName: t.customName, cwd })
  }
  const activeCandidate = typeof r.activeId === 'string' ? r.activeId : ''
  const activeId = tabs.some(t => t.id === activeCandidate) ? activeCandidate : tabs[0].id
  return { tabs, activeId }
}

export async function createRealTabsStore(): Promise<TabsStore> {
  const Mod = await import('electron-store')
  const ElectronStore = (Mod as unknown as { default: new (opts: unknown) => { store: unknown; set: (s: unknown) => void } }).default
  const store = new ElectronStore({
    name: 'tabs',
    defaults: INITIAL_TABS_STATE,
  })

  return {
    load(): TabsState {
      try {
        return validateTabsState(store.store)
      } catch (err) {
        console.error('[tabsStore] load failed:', err)
        return INITIAL_TABS_STATE
      }
    },
    save(s: TabsState): void {
      try {
        store.set(s as unknown as Record<string, unknown>)
      } catch (err) {
        console.error('[tabsStore] save failed:', err)
      }
    },
  }
}
