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
  onPtyData(cb: (payload: { tabId: string; data: string }) => void): () => boolean
  ptyWrite(tabId: string, data: string): void
  ptyResize(tabId: string, size: { cols: number; rows: number }): void
  onSettingsChanged(cb: (settings: Settings) => void): () => boolean
  onPanelToggle(cb: () => void): () => boolean
  onYoutubeReload(cb: () => void): () => boolean
  settingsGetInitial(): Promise<Settings>
  settingsSetTransparency(value: number): void
  settingsSetColor(color: ColorKey): void
  settingsSetBlur(value: number): void
  settingsSetAdBlock(value: boolean): void
  settingsReset(): void
  onTabsState(cb: (state: TabsState) => void): () => boolean
  onStartRename(cb: (tabId: string) => void): () => boolean
  tabsGetInitial(): Promise<TabsState>
  tabsNew(): void
  tabsClose(tabId: string): void
  tabsActivate(tabId: string): void
  tabsRename(tabId: string, name: string | null): void
  tabsContextMenu(tabId: string, x: number, y: number): void
}

export type ColorKey = 'black' | 'dark-gray' | 'dark-blue' | 'dark-green'

export interface Settings {
  transparency: number
  bgColor: ColorKey
  lastMode: Mode
  blur: number
  youtubeLastUrl: string | null
  videoFillMode: boolean
  adBlockEnabled: boolean
}

export const INITIAL_SETTINGS: Settings = {
  transparency: 0.75,
  bgColor: 'black',
  lastMode: 'overlay',
  blur: 0.1,
  youtubeLastUrl: null,
  videoFillMode: false,
  adBlockEnabled: true,
}

export const COLOR_VALUES: Record<ColorKey, { r: number; g: number; b: number }> = {
  'black':      { r: 0,  g: 0,  b: 0  },
  'dark-gray':  { r: 24, g: 24, b: 24 },
  'dark-blue':  { r: 10, g: 15, b: 35 },
  'dark-green': { r: 10, g: 24, b: 14 },
}

export interface Tab {
  id: string
  customName: string | null
  cwd: string | null
}

export interface TabsState {
  tabs: Tab[]
  activeId: string
}

export const INITIAL_TABS_STATE: TabsState = {
  tabs: [{ id: '1', customName: null, cwd: null }],
  activeId: '1',
}

declare global {
  interface Window {
    youtermAPI: YoutermAPI
  }
}
