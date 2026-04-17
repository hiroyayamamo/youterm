import type { Settings, ColorKey, Mode } from '../shared/types'
import { INITIAL_SETTINGS, COLOR_VALUES } from '../shared/types'

export interface SettingsStore {
  load(): Settings
  save(s: Settings): void
}

const VALID_MODES: Mode[] = ['youtube-only', 'overlay', 'terminal-only']
const VALID_COLORS = Object.keys(COLOR_VALUES) as ColorKey[]

export function validateAndNormalize(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return INITIAL_SETTINGS
  const r = raw as Record<string, unknown>

  const transparency =
    typeof r.transparency === 'number' && r.transparency >= 0 && r.transparency <= 0.9
      ? r.transparency
      : INITIAL_SETTINGS.transparency

  const bgColor =
    typeof r.bgColor === 'string' && VALID_COLORS.includes(r.bgColor as ColorKey)
      ? (r.bgColor as ColorKey)
      : INITIAL_SETTINGS.bgColor

  const lastMode =
    typeof r.lastMode === 'string' && VALID_MODES.includes(r.lastMode as Mode)
      ? (r.lastMode as Mode)
      : INITIAL_SETTINGS.lastMode

  const blur =
    typeof r.blur === 'number' && r.blur >= 0 && r.blur <= 1
      ? r.blur
      : INITIAL_SETTINGS.blur

  return { transparency, bgColor, lastMode, blur }
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
