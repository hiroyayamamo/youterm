import type { Settings, ColorKey, Mode } from '../shared/types'
import { INITIAL_SETTINGS, COLOR_VALUES } from '../shared/types'

export interface SettingsStore {
  load(): Settings
  save(s: Settings): void
}

// For testability: the raw read function
export type StoreRawReader = () => unknown

const VALID_MODES: Mode[] = ['youtube-only', 'overlay', 'terminal-only']
const VALID_COLORS = Object.keys(COLOR_VALUES) as ColorKey[]

export function validateAndNormalize(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return INITIAL_SETTINGS
  const r = raw as Record<string, unknown>

  if (typeof r.transparency !== 'number') return INITIAL_SETTINGS
  if (r.transparency < 0 || r.transparency > 0.9) return INITIAL_SETTINGS

  if (typeof r.bgColor !== 'string') return INITIAL_SETTINGS
  if (!VALID_COLORS.includes(r.bgColor as ColorKey)) return INITIAL_SETTINGS

  if (typeof r.lastMode !== 'string') return INITIAL_SETTINGS
  if (!VALID_MODES.includes(r.lastMode as Mode)) return INITIAL_SETTINGS

  return {
    transparency: r.transparency,
    bgColor: r.bgColor as ColorKey,
    lastMode: r.lastMode as Mode,
  }
}

export async function createRealSettingsStore(): Promise<SettingsStore> {
  // Dynamic import so tests don't pull electron-store
  const Mod = await import('electron-store')
  const ElectronStore = (Mod as unknown as { default: new (opts: unknown) => { store: unknown; set: (s: unknown) => void } }).default
  const store = new ElectronStore({
    name: 'settings',
    defaults: INITIAL_SETTINGS,
  })

  return {
    load(): Settings {
      try {
        return validateAndNormalize(store.store)
      } catch (err) {
        console.error('[settingsStore] load failed:', err)
        return INITIAL_SETTINGS
      }
    },
    save(s: Settings): void {
      try {
        store.set(s as unknown as Record<string, unknown>)
      } catch (err) {
        console.error('[settingsStore] save failed:', err)
      }
    },
  }
}
