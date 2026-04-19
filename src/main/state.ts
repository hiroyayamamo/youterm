import type { AppState, Mode } from '../shared/types'
export { INITIAL_STATE } from '../shared/types'

export type Action =
  | { type: 'set-mode'; mode: Mode }

export function transition(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-mode':
      if (state.mode === action.mode) return state
      return { mode: action.mode }
  }
}
