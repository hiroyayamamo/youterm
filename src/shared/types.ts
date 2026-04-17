export type Mode = 'youtube-only' | 'overlay' | 'terminal-only'
export type InputTarget = 'youtube' | 'terminal'

export interface AppState {
  mode: Mode
  inputTarget: InputTarget
}

export const INITIAL_STATE: AppState = {
  mode: 'overlay',
  inputTarget: 'terminal',
}
