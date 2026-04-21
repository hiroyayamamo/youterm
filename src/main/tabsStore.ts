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

function migrate(raw: unknown): TabsState {
  if (!raw || typeof raw !== 'object') return INITIAL_TABS_STATE
  const obj = raw as Record<string, unknown>

  // Old shape: { tabs, activeId }
  if (Array.isArray(obj.tabs) && typeof obj.activeId === 'string' && !('panes' in obj)) {
    if (!obj.tabs.every((t: unknown) => isValidTab(t))) return INITIAL_TABS_STATE
    const tabs = (obj.tabs as Array<{ id: string; customName: string | null; cwd?: string | null }>).map(t => ({
      id: t.id,
      customName: t.customName,
      cwd: typeof t.cwd === 'string' ? t.cwd : null,
    })) as TabsState['panes'][0]['tabs']
    return {
      panes: [{ tabs, activeId: obj.activeId as string }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
  }

  // New shape validation
  if (!Array.isArray(obj.panes) || obj.panes.length < 1 || obj.panes.length > 2) {
    return INITIAL_TABS_STATE
  }
  const panes = (obj.panes as unknown[]).map(p => {
    if (!p || typeof p !== 'object') return null
    const pp = p as Record<string, unknown>
    if (!Array.isArray(pp.tabs) || typeof pp.activeId !== 'string') return null
    if (!pp.tabs.every((t: unknown) => isValidTab(t))) return null
    const tabs = (pp.tabs as Array<{ id: string; customName: string | null; cwd?: string | null }>).map(t => ({
      id: t.id,
      customName: t.customName,
      cwd: typeof t.cwd === 'string' ? t.cwd : null,
    })) as TabsState['panes'][0]['tabs']
    return { tabs, activeId: pp.activeId as string }
  })
  if (panes.some(p => p === null)) return INITIAL_TABS_STATE
  const panesValid = panes as TabsState['panes']
  // Every pane must have ≥1 tab; activeId must exist among its tabs
  for (const p of panesValid) {
    if (p.tabs.length === 0) return INITIAL_TABS_STATE
    if (!p.tabs.some(t => t.id === p.activeId)) return INITIAL_TABS_STATE
  }

  const activePaneIndex =
    typeof obj.activePaneIndex === 'number' && obj.activePaneIndex >= 0 && obj.activePaneIndex < panesValid.length
      ? obj.activePaneIndex
      : 0

  let splitRatio = typeof obj.splitRatio === 'number' ? obj.splitRatio : 0.5
  if (!Number.isFinite(splitRatio) || splitRatio < 0.1 || splitRatio > 0.9) splitRatio = 0.5

  return { panes: panesValid, activePaneIndex, splitRatio }
}

export function validateTabsState(raw: unknown): TabsState {
  return migrate(raw)
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
        return migrate(store.store)
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
