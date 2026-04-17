import type { Settings } from '../shared/types'
import { transitionSettings, type SettingsAction } from './settings'
import type { SettingsStore } from './settingsStore'

export interface SettingsController {
  getSettings(): Settings
  dispatch(action: SettingsAction): void
  subscribe(cb: (s: Settings) => void): () => void
}

export interface CreateSettingsControllerDeps {
  store: SettingsStore
  debounceMs?: number
}

export function createSettingsController(deps: CreateSettingsControllerDeps): SettingsController {
  const debounceMs = deps.debounceMs ?? 200
  let state: Settings = deps.store.load()
  const subscribers = new Set<(s: Settings) => void>()
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      deps.store.save(state)
    }, debounceMs)
  }

  return {
    getSettings: () => state,
    dispatch(action) {
      const next = transitionSettings(state, action)
      if (next === state) return
      state = next
      for (const cb of subscribers) cb(state)
      scheduleSave()
    },
    subscribe(cb) {
      subscribers.add(cb)
      return () => {
        subscribers.delete(cb)
      }
    },
  }
}
