import type { AppState, Mode } from '../shared/types'
export { INITIAL_STATE } from '../shared/types'

export type Action =
  | { type: 'set-mode'; mode: Mode }
  | { type: 'toggle-input-target' }

const defaultInputTargetFor = (mode: Mode): 'youtube' | 'terminal' => {
  switch (mode) {
    case 'youtube-only':
      return 'youtube'
    case 'overlay':
    case 'terminal-only':
      return 'terminal'
  }
}

export function transition(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-mode':
      if (state.mode === action.mode) return state
      return {
        mode: action.mode,
        inputTarget: defaultInputTargetFor(action.mode),
      }
    case 'toggle-input-target':
      if (state.mode !== 'overlay') return state
      return {
        ...state,
        inputTarget: state.inputTarget === 'terminal' ? 'youtube' : 'terminal',
      }
  }
}
