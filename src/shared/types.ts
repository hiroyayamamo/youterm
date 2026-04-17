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
  onSettingsChanged(cb: (settings: Settings) => void): () => boolean
  onPanelToggle(cb: () => void): () => boolean
  settingsGetInitial(): Promise<Settings>
  settingsSetTransparency(value: number): void
  settingsSetColor(color: ColorKey): void
  settingsSetBlur(value: number): void
  settingsReset(): void
}

export type ColorKey = 'black' | 'dark-gray' | 'dark-blue' | 'dark-green'

export interface Settings {
  transparency: number
  bgColor: ColorKey
  lastMode: Mode
  blur: number
}

export const INITIAL_SETTINGS: Settings = {
  transparency: 0.75,
  bgColor: 'black',
  lastMode: 'overlay',
  blur: 0.1,
}

export const COLOR_VALUES: Record<ColorKey, { r: number; g: number; b: number }> = {
  'black':      { r: 0,  g: 0,  b: 0  },
  'dark-gray':  { r: 24, g: 24, b: 24 },
  'dark-blue':  { r: 10, g: 15, b: 35 },
  'dark-green': { r: 10, g: 24, b: 14 },
}

declare global {
  interface Window {
    youtermAPI: YoutermAPI
  }
}
