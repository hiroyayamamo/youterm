import type { Settings, ColorKey, Mode } from '../shared/types'
import { INITIAL_SETTINGS } from '../shared/types'

export type SettingsAction =
  | { type: 'set-transparency'; value: number }
  | { type: 'set-color'; color: ColorKey }
  | { type: 'set-last-mode'; mode: Mode }
  | { type: 'set-blur'; value: number }
  | { type: 'reset' }

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n))

export function transitionSettings(state: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'set-transparency': {
      const next = clamp(action.value, 0, 0.9)
      if (next === state.transparency) return state
      return { ...state, transparency: next }
    }
    case 'set-color': {
      if (action.color === state.bgColor) return state
      return { ...state, bgColor: action.color }
    }
    case 'set-last-mode': {
      if (action.mode === state.lastMode) return state
      return { ...state, lastMode: action.mode }
    }
    case 'set-blur': {
      const next = clamp(action.value, 0, 1)
      if (next === state.blur) return state
      return { ...state, blur: next }
    }
    case 'reset': {
      if (
        state.transparency === INITIAL_SETTINGS.transparency &&
        state.bgColor === INITIAL_SETTINGS.bgColor &&
        state.lastMode === INITIAL_SETTINGS.lastMode &&
        state.blur === INITIAL_SETTINGS.blur
      ) {
        return INITIAL_SETTINGS
      }
      return INITIAL_SETTINGS
    }
  }
}
