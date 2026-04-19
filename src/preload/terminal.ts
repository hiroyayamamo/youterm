import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppState, Settings, ColorKey, TabsState } from '../shared/types'

type StateHandler = (s: AppState) => void
type PtyDataHandler = (p: { tabId: string; data: string }) => void
type SettingsHandler = (s: Settings) => void
type VoidHandler = () => void
type TabsStateHandler = (s: TabsState) => void
type StartRenameHandler = (tabId: string) => void

const stateHandlers = new Set<StateHandler>()
const ptyDataHandlers = new Set<PtyDataHandler>()
const settingsHandlers = new Set<SettingsHandler>()
const panelToggleHandlers = new Set<VoidHandler>()
const youtubeReloadHandlers = new Set<VoidHandler>()
const tabsStateHandlers = new Set<TabsStateHandler>()
const startRenameHandlers = new Set<StartRenameHandler>()

ipcRenderer.on('state:changed', (_e, state: AppState) => {
  for (const h of stateHandlers) h(state)
})
ipcRenderer.on('pty:data', (_e, payload: { tabId: string; data: string }) => {
  for (const h of ptyDataHandlers) h(payload)
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
let activeTabId: string | null = null
ipcRenderer.on('tabs:state', (_e, s: TabsState) => {
  activeTabId = s.activeId
  for (const h of tabsStateHandlers) h(s)
})
ipcRenderer.on('tabs:start-rename', (_e, tabId: string) => {
  for (const h of startRenameHandlers) h(tabId)
})

contextBridge.exposeInMainWorld('youtermAPI', {
  onStateChanged(cb: StateHandler) {
    stateHandlers.add(cb)
    return () => stateHandlers.delete(cb)
  },
  stateGetInitial(): Promise<AppState> { return ipcRenderer.invoke('state:get-initial') },
  onPtyData(cb: PtyDataHandler) {
    ptyDataHandlers.add(cb)
    return () => ptyDataHandlers.delete(cb)
  },
  ptyWrite(tabId: string, data: string) {
    ipcRenderer.send('pty:write', { tabId, data })
  },
  ptyResize(tabId: string, size: { cols: number; rows: number }) {
    ipcRenderer.send('pty:resize', { tabId, cols: size.cols, rows: size.rows })
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
  settingsSetTransparency(value: number) { ipcRenderer.send('settings:set-transparency', value) },
  settingsSetBlur(value: number) { ipcRenderer.send('settings:set-blur', value) },
  settingsSetAdBlock(value: boolean) { ipcRenderer.send('settings:set-ad-block', value) },
  settingsSetColor(color: ColorKey) { ipcRenderer.send('settings:set-color', color) },
  settingsReset() { ipcRenderer.send('settings:reset') },

  onTabsState(cb: TabsStateHandler) {
    tabsStateHandlers.add(cb)
    return () => tabsStateHandlers.delete(cb)
  },
  onStartRename(cb: StartRenameHandler) {
    startRenameHandlers.add(cb)
    return () => startRenameHandlers.delete(cb)
  },
  tabsGetInitial(): Promise<TabsState> { return ipcRenderer.invoke('tabs:get-initial') },
  tabsNew() { ipcRenderer.send('tabs:new') },
  tabsClose(tabId: string) { ipcRenderer.send('tabs:close', { tabId }) },
  tabsActivate(tabId: string) { ipcRenderer.send('tabs:activate', { tabId }) },
  tabsRename(tabId: string, name: string | null) { ipcRenderer.send('tabs:rename', { tabId, name }) },
  tabsContextMenu(tabId: string, x: number, y: number) { ipcRenderer.send('tabs:context-menu', { tabId, x, y }) },

  terminalRuntimeReady(tabId: string) { ipcRenderer.send('terminal:runtime-ready', tabId) },
})

// Finder drag-and-drop handling is attached DIRECTLY in the preload so it
// registers at document_start, before the renderer's async init() runs. If
// these listeners are installed late, macOS sees "no drop target accepted"
// and animates the file back to its origin — which is exactly the symptom we
// were hitting while the handlers lived in the renderer's init path.
const shellQuote = (p: string): string => `'${p.replace(/'/g, "'\\''")}'`

const preventDefault = (e: DragEvent) => {
  if (!e.dataTransfer) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}
document.addEventListener('dragenter', preventDefault, true)
document.addEventListener('dragover', preventDefault, true)

document.addEventListener('drop', e => {
  e.preventDefault()
  if (!activeTabId) return
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const parts: string[] = []
  for (const file of Array.from(files)) {
    try {
      const p = webUtils.getPathForFile(file)
      if (p) parts.push(shellQuote(p))
    } catch {}
  }
  if (parts.length === 0) return
  ipcRenderer.send('pty:write', { tabId: activeTabId, data: parts.join(' ') + ' ' })
}, true)
