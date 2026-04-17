import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, Settings, ColorKey } from '../shared/types'

type StateHandler = (s: AppState) => void
type DataHandler = (d: string) => void
type SettingsHandler = (s: Settings) => void
type VoidHandler = () => void

const stateHandlers = new Set<StateHandler>()
const dataHandlers = new Set<DataHandler>()
const settingsHandlers = new Set<SettingsHandler>()
const panelToggleHandlers = new Set<VoidHandler>()
const youtubeReloadHandlers = new Set<VoidHandler>()

ipcRenderer.on('state:changed', (_e, state: AppState) => {
  for (const h of stateHandlers) h(state)
})
ipcRenderer.on('pty:data', (_e, data: string) => {
  for (const h of dataHandlers) h(data)
})
ipcRenderer.on('settings:changed', (_e, s: Settings) => {
  for (const h of settingsHandlers) h(s)
})
ipcRenderer.on('panel:toggle', () => {
  for (const h of panelToggleHandlers) h()
})
ipcRenderer.on('youtube:reload', () => {
  for (const h of youtubeReloadHandlers) h()
})

contextBridge.exposeInMainWorld('youtermAPI', {
  onStateChanged(cb: StateHandler) {
    stateHandlers.add(cb)
    return () => stateHandlers.delete(cb)
  },
  onPtyData(cb: DataHandler) {
    dataHandlers.add(cb)
    return () => dataHandlers.delete(cb)
  },
  ptyWrite(data: string) {
    ipcRenderer.send('pty:write', data)
  },
  ptyResize(size: { cols: number; rows: number }) {
    ipcRenderer.send('pty:resize', size)
  },

  onSettingsChanged(cb: SettingsHandler) {
    settingsHandlers.add(cb)
    return () => settingsHandlers.delete(cb)
  },
  onPanelToggle(cb: VoidHandler) {
    panelToggleHandlers.add(cb)
    return () => panelToggleHandlers.delete(cb)
  },
  onYoutubeReload(cb: VoidHandler) {
    youtubeReloadHandlers.add(cb)
    return () => youtubeReloadHandlers.delete(cb)
  },
  settingsGetInitial(): Promise<Settings> {
    return ipcRenderer.invoke('settings:get-initial')
  },
  settingsSetTransparency(value: number) {
    ipcRenderer.send('settings:set-transparency', value)
  },
  settingsSetBlur(value: number) {
    ipcRenderer.send('settings:set-blur', value)
  },
  settingsSetColor(color: ColorKey) {
    ipcRenderer.send('settings:set-color', color)
  },
  settingsReset() {
    ipcRenderer.send('settings:reset')
  },
})
