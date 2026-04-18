import { ipcMain, dialog, Menu, MenuItem, BrowserWindow, type WebContentsView } from 'electron'
import os from 'node:os'
import { exec } from 'node:child_process'
import { createRealPtySpawn, type PtyHandle, type PtySpawn } from './pty'
import type { TabsController } from './tabsController'
import { createTabsController } from './tabsController'
import { createRealTabsStore } from './tabsStore'
import type { SettingsController } from './settingsController'
import type { Settings, ColorKey } from '../shared/types'

const VALID_COLORS: ColorKey[] = ['black', 'dark-gray', 'dark-blue', 'dark-green']

export interface TabsBridge {
  tabsController: TabsController
  dispose(): void
}

export async function attachTabs(
  win: BrowserWindow,
  terminalView: WebContentsView,
): Promise<TabsBridge> {
  const spawn: PtySpawn = await createRealPtySpawn()
  const pidByTab = new Map<string, number>()
  const tabsStore = await createRealTabsStore()

  const spawnPtyWithPid = (tabId: string): PtyHandle => {
    const rawPty = spawn('/bin/zsh', ['-l'], {
      cwd: os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      cols: 120,
      rows: 30,
      name: 'xterm-256color',
    })
    const maybePid = (rawPty as unknown as { pid?: number }).pid
    if (typeof maybePid === 'number') pidByTab.set(tabId, maybePid)

    const dataHandlers: Array<(data: string) => void> = []
    const exitHandlers: Array<() => void> = []
    rawPty.onData(data => { for (const h of dataHandlers) h(data) })
    rawPty.onExit(() => { for (const h of exitHandlers) h() })

    return {
      onData(cb) {
        dataHandlers.push(cb)
        return () => {
          const i = dataHandlers.indexOf(cb)
          if (i >= 0) dataHandlers.splice(i, 1)
        }
      },
      onExit(cb) {
        exitHandlers.push(cb)
        return () => {
          const i = exitHandlers.indexOf(cb)
          if (i >= 0) exitHandlers.splice(i, 1)
        }
      },
      write: d => rawPty.write(d),
      resize: (c, r) => rawPty.resize(c, r),
      kill: () => {
        pidByTab.delete(tabId)
        rawPty.kill()
      },
    }
  }

  const hasChildren = (tabId: string): Promise<boolean> => {
    const pid = pidByTab.get(tabId)
    if (!pid) return Promise.resolve(false)
    return new Promise(resolve => {
      exec(`pgrep -P ${pid}`, (err, stdout) => {
        if (err) {
          // pgrep exits 1 when no matches (not a real error); treat as "no children"
          resolve(false)
          return
        }
        resolve(stdout.trim().length > 0)
      })
    })
  }

  const tabsController = createTabsController({
    spawnPty: spawnPtyWithPid,
    hasChildren,
    onDialogConfirm: async () => {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        message: 'Close this tab?',
        detail: 'A process is still running. Closing will terminate it.',
        buttons: ['Close', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      })
      return response === 0
    },
    onData: (tabId, data) => {
      if (!terminalView.webContents.isDestroyed()) {
        terminalView.webContents.send('pty:data', { tabId, data })
      }
    },
    store: tabsStore,
  })

  const broadcastState = () => {
    if (!terminalView.webContents.isDestroyed()) {
      terminalView.webContents.send('tabs:state', tabsController.getState())
    }
  }
  tabsController.subscribe(broadcastState)

  // handlers
  const onNew = () => tabsController.newTab()
  const onClose = async (_e: unknown, arg: unknown) => {
    if (typeof arg !== 'object' || !arg) return
    const { tabId } = arg as { tabId: string }
    const result = await tabsController.closeTab(tabId)
    if (result === 'close-window') win.close()
  }
  const onActivate = (_e: unknown, arg: unknown) => {
    if (typeof arg !== 'object' || !arg) return
    const { tabId } = arg as { tabId: string }
    tabsController.activateTab(tabId)
  }
  const onRename = (_e: unknown, arg: unknown) => {
    if (typeof arg !== 'object' || !arg) return
    const { tabId, name } = arg as { tabId: string; name: string | null }
    const cleaned = typeof name === 'string' && name.trim() === '' ? null : name
    tabsController.renameTab(tabId, cleaned)
  }
  const onWrite = (_e: unknown, arg: unknown) => {
    if (typeof arg !== 'object' || !arg) return
    const { tabId, data } = arg as { tabId: string; data: string }
    tabsController.write(tabId, data)
  }
  const onResize = (_e: unknown, arg: unknown) => {
    if (typeof arg !== 'object' || !arg) return
    const { tabId, cols, rows } = arg as { tabId: string; cols: number; rows: number }
    tabsController.resize(tabId, cols, rows)
  }
  const onContextMenu = (_e: unknown, arg: unknown) => {
    if (typeof arg !== 'object' || !arg) return
    const { tabId, x, y } = arg as { tabId: string; x: number; y: number }
    const menu = new Menu()
    menu.append(new MenuItem({
      label: 'Close tab',
      click: async () => {
        const result = await tabsController.closeTab(tabId)
        if (result === 'close-window') win.close()
      },
    }))
    menu.append(new MenuItem({
      label: 'Rename tab',
      click: () => {
        if (!terminalView.webContents.isDestroyed()) {
          terminalView.webContents.send('tabs:start-rename', tabId)
        }
      },
    }))
    menu.popup({ window: win, x: Math.round(x), y: Math.round(y) })
  }

  ipcMain.on('tabs:new', onNew)
  ipcMain.on('tabs:close', onClose)
  ipcMain.on('tabs:activate', onActivate)
  ipcMain.on('tabs:rename', onRename)
  ipcMain.on('pty:write', onWrite)
  ipcMain.on('pty:resize', onResize)
  ipcMain.on('tabs:context-menu', onContextMenu)

  const handleGetInitial = () => tabsController.getState()
  ipcMain.handle('tabs:get-initial', handleGetInitial)

  // Initial state broadcast (after renderer subscribes)
  setTimeout(broadcastState, 0)

  return {
    tabsController,
    dispose() {
      ipcMain.removeListener('tabs:new', onNew)
      ipcMain.removeListener('tabs:close', onClose)
      ipcMain.removeListener('tabs:activate', onActivate)
      ipcMain.removeListener('tabs:rename', onRename)
      ipcMain.removeListener('pty:write', onWrite)
      ipcMain.removeListener('pty:resize', onResize)
      ipcMain.removeListener('tabs:context-menu', onContextMenu)
      ipcMain.removeHandler('tabs:get-initial')
      tabsController.disposeAll()
    },
  }
}

// Settings bridge (unchanged from v0.3.x)
export interface SettingsBridge {
  dispose(): void
}

export function attachSettings(
  terminalView: WebContentsView,
  settings: SettingsController,
): SettingsBridge {
  const broadcastUnsub = settings.subscribe(s => {
    if (!terminalView.webContents.isDestroyed()) {
      terminalView.webContents.send('settings:changed', s)
    }
  })

  const onSetTransparency = (_e: unknown, value: unknown) => {
    if (typeof value === 'number') settings.dispatch({ type: 'set-transparency', value })
  }
  const onSetBlur = (_e: unknown, value: unknown) => {
    if (typeof value === 'number') settings.dispatch({ type: 'set-blur', value })
  }
  const onSetColor = (_e: unknown, color: unknown) => {
    if (typeof color === 'string' && (VALID_COLORS as string[]).includes(color)) {
      settings.dispatch({ type: 'set-color', color: color as ColorKey })
    }
  }
  const onReset = () => settings.dispatch({ type: 'reset' })

  ipcMain.on('settings:set-transparency', onSetTransparency)
  ipcMain.on('settings:set-blur', onSetBlur)
  ipcMain.on('settings:set-color', onSetColor)
  ipcMain.on('settings:reset', onReset)

  const handleGetInitial = (): Settings => settings.getSettings()
  ipcMain.handle('settings:get-initial', handleGetInitial)

  return {
    dispose() {
      ipcMain.removeListener('settings:set-transparency', onSetTransparency)
      ipcMain.removeListener('settings:set-blur', onSetBlur)
      ipcMain.removeListener('settings:set-color', onSetColor)
      ipcMain.removeListener('settings:reset', onReset)
      ipcMain.removeHandler('settings:get-initial')
      broadcastUnsub()
    },
  }
}

// YoutubeBridge: URL tracking + login popup
const YOUTUBE_NAV_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com']
const GOOGLE_AUTH_HOST_RE = /(^|\.)accounts\.google\.com$|(^|\.)myaccount\.google\.com$/i

function isYoutubeNavUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return YOUTUBE_NAV_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

function isGoogleAuthUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return GOOGLE_AUTH_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

function isYoutubeHomeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return YOUTUBE_NAV_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

export interface YoutubeBridge {
  dispose(): void
}

export function attachYoutube(
  win: BrowserWindow,
  terminalView: WebContentsView,
  settings: SettingsController,
): YoutubeBridge {
  let disposed = false
  let activeLoginWin: BrowserWindow | null = null

  const onFrameNavigate = (
    _event: unknown,
    url: string,
    _httpResponseCode: number,
    _httpStatusText: string,
    isMainFrame: boolean,
  ) => {
    if (isMainFrame) return
    if (!isYoutubeNavUrl(url)) return
    if (disposed) return
    settings.dispatch({ type: 'set-youtube-url', url })
  }

  const onWillFrameNavigate = (event: Electron.Event & { url: string }) => {
    if (disposed) return
    const url = event.url
    if (!isGoogleAuthUrl(url)) return
    event.preventDefault()
    openLoginWindow(url)
  }

  function openLoginWindow(url: string): void {
    if (activeLoginWin && !activeLoginWin.isDestroyed()) {
      activeLoginWin.focus()
      activeLoginWin.webContents.loadURL(url).catch(() => {})
      return
    }
    const terminalSession = terminalView.webContents.session
    const loginWin = new BrowserWindow({
      width: 480,
      height: 640,
      parent: win,
      modal: false,
      autoHideMenuBar: true,
      title: 'Sign in — youterm',
      webPreferences: {
        session: terminalSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    activeLoginWin = loginWin

    const onLoginNav = (_e: unknown, currentUrl: string) => {
      if (isYoutubeHomeUrl(currentUrl)) {
        // Login complete; close popup and reload iframe to pick up new cookies
        if (!loginWin.isDestroyed()) loginWin.close()
        if (!terminalView.webContents.isDestroyed()) {
          terminalView.webContents.send('youtube:reload')
        }
      }
    }
    loginWin.webContents.on('did-navigate', onLoginNav)
    loginWin.on('closed', () => {
      loginWin.webContents.removeListener('did-navigate', onLoginNav)
      if (activeLoginWin === loginWin) activeLoginWin = null
    })

    loginWin.loadURL(url).catch(() => {})
  }

  terminalView.webContents.on('did-frame-navigate', onFrameNavigate)
  // will-frame-navigate signature: (event, url, isMainFrame, frameProcessId, frameRoutingId)
  // Use a wrapper that matches Electron's type
  const onWillFrameNavigateWrapper = (event: Electron.Event) => {
    // Electron types for will-frame-navigate pass the event only; URL is on event.url
    onWillFrameNavigate(event as Electron.Event & { url: string })
  }
  // Older Electron used 'will-navigate' for same-origin frame nav; prefer 'will-frame-navigate' for all frames
  terminalView.webContents.on('will-frame-navigate', onWillFrameNavigateWrapper)

  return {
    dispose() {
      disposed = true
      terminalView.webContents.removeListener('did-frame-navigate', onFrameNavigate)
      terminalView.webContents.removeListener('will-frame-navigate', onWillFrameNavigateWrapper)
      if (activeLoginWin && !activeLoginWin.isDestroyed()) activeLoginWin.close()
    },
  }
}
