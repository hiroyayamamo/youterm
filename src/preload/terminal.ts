import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppState, Settings, ColorKey, TabsState } from '../shared/types'

type StateHandler = (s: AppState) => void
type PtyDataHandler = (p: { tabId: string; data: string }) => void
type SettingsHandler = (s: Settings) => void
type VoidHandler = () => void
type YoutubeReloadHandler = (url?: string) => void
type TabsStateHandler = (s: TabsState) => void
type StartRenameHandler = (tabId: string) => void

const stateHandlers = new Set<StateHandler>()
const ptyDataHandlers = new Set<PtyDataHandler>()
const settingsHandlers = new Set<SettingsHandler>()
const panelToggleHandlers = new Set<VoidHandler>()
const youtubeReloadHandlers = new Set<YoutubeReloadHandler>()
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
ipcRenderer.on('youtube:reload', (_e, url?: string) => {
  for (const h of youtubeReloadHandlers) h(url)
})
let activeTabId: string | null = null
ipcRenderer.on('tabs:state', (_e, s: TabsState) => {
  // File-drop handler routes to the focused pane's active tab.
  activeTabId = s.panes[s.activePaneIndex]?.activeId ?? null
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
  onYoutubeReload(cb: YoutubeReloadHandler) {
    youtubeReloadHandlers.add(cb)
    return () => youtubeReloadHandlers.delete(cb)
  },
  youtubeGoBack() { ipcRenderer.send('youtube:nav:back') },
  youtubeGoForward() { ipcRenderer.send('youtube:nav:forward') },
  youtubeReload() { ipcRenderer.send('youtube:nav:reload') },
  settingsGetInitial(): Promise<Settings> {
    return ipcRenderer.invoke('settings:get-initial')
  },
  settingsSetTransparency(value: number) { ipcRenderer.send('settings:set-transparency', value) },
  settingsSetBlur(value: number) { ipcRenderer.send('settings:set-blur', value) },
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
  tabsMove(tabId: string, beforeTabId: string | null) { ipcRenderer.send('tabs:move', { tabId, beforeTabId }) },
  tabsMoveAcross(tabId: string, paneIndex: 0 | 1, beforeTabId: string | null) {
    ipcRenderer.send('tabs:move-across', { tabId, paneIndex, beforeTabId })
  },
  panesToggleSplit() { ipcRenderer.send('panes:toggle-split') },
  panesActivate(index: 0 | 1) { ipcRenderer.send('panes:activate', { index }) },
  panesSetRatio(ratio: number) { ipcRenderer.send('panes:set-ratio', { ratio }) },
  tabsContextMenu(tabId: string, x: number, y: number) { ipcRenderer.send('tabs:context-menu', { tabId, x, y }) },

  terminalRuntimeReady(tabId: string) { ipcRenderer.send('terminal:runtime-ready', tabId) },
})

// Finder drag-and-drop handling is attached directly in the preload so it
// registers at document_start, before the renderer's async init() runs.
// Iframe inertness (to avoid Chromium's OOPIF routing swallowing drops into
// the YouTube frame) is handled via CSS on body classes, not here.
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
  ipcRenderer.send('dnd:drop', parts.join(' ') + ' ')
}, true)
