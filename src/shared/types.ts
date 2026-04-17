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

export interface YoutermAPI {
  onStateChanged(cb: (state: AppState) => void): () => boolean
  onPtyData(cb: (data: string) => void): () => boolean
  ptyWrite(data: string): void
  ptyResize(size: { cols: number; rows: number }): void
}

declare global {
  interface Window {
    youtermAPI: YoutermAPI
  }
}
