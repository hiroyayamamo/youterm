import { ipcMain, dialog, Menu, MenuItem, BrowserWindow, type WebContentsView } from 'electron'
import os from 'node:os'
import { exec } from 'node:child_process'
import { createRealPtySpawn, type PtyHandle, type PtySpawn } from './pty'
import type { TabsController } from './tabsController'
import { createTabsController } from './tabsController'
import { createRealTabsStore } from './tabsStore'
import type { SettingsController } from './settingsController'
import { createAdBlockController } from './adBlock'
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
  const onSetAdBlock = (_e: unknown, value: unknown) => {
    if (typeof value === 'boolean') settings.dispatch({ type: 'set-ad-block', value })
  }
  const onSetColor = (_e: unknown, color: unknown) => {
    if (typeof color === 'string' && (VALID_COLORS as string[]).includes(color)) {
      settings.dispatch({ type: 'set-color', color: color as ColorKey })
    }
  }
  const onReset = () => settings.dispatch({ type: 'reset' })

  ipcMain.on('settings:set-transparency', onSetTransparency)
  ipcMain.on('settings:set-blur', onSetBlur)
  ipcMain.on('settings:set-ad-block', onSetAdBlock)
  ipcMain.on('settings:set-color', onSetColor)
  ipcMain.on('settings:reset', onReset)

  const handleGetInitial = (): Settings => settings.getSettings()
  ipcMain.handle('settings:get-initial', handleGetInitial)

  return {
    dispose() {
      ipcMain.removeListener('settings:set-transparency', onSetTransparency)
      ipcMain.removeListener('settings:set-blur', onSetBlur)
      ipcMain.removeListener('settings:set-ad-block', onSetAdBlock)
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
  flushPlayback(): Promise<void>
}

export async function attachYoutube(
  win: BrowserWindow,
  terminalView: WebContentsView,
  settings: SettingsController,
): Promise<YoutubeBridge> {
  let disposed = false
  let activeLoginWin: BrowserWindow | null = null

  const adBlock = await createAdBlockController(terminalView.webContents.session)
  await adBlock.setEnabled(settings.getSettings().adBlockEnabled)

  const VIDEO_FILL_CSS = `
html.youterm-video-fill {
  overflow: hidden !important;
  background: #000 !important;
}
html.youterm-video-fill body {
  background: #000 !important;
}

/* Hide specific chrome elements (narrow list; do NOT use broad ytd-app > * selector) */
html.youterm-video-fill #masthead-container,
html.youterm-video-fill tp-yt-app-drawer,
html.youterm-video-fill ytd-mini-guide-renderer,
html.youterm-video-fill ytd-popup-container,
html.youterm-video-fill ytd-watch-flexy #secondary,
html.youterm-video-fill ytd-watch-flexy #below,
html.youterm-video-fill ytd-watch-flexy #chat,
html.youterm-video-fill ytd-watch-flexy ytd-watch-metadata,
html.youterm-video-fill ytd-watch-flexy ytd-merch-shelf-renderer,
html.youterm-video-fill ytd-comments {
  display: none !important;
}

/* Force the #movie_player ancestor chain to be laid out (no display:none, no containment) */
html.youterm-video-fill ytd-app,
html.youterm-video-fill ytd-page-manager,
html.youterm-video-fill ytd-watch-flexy,
html.youterm-video-fill ytd-watch-flexy #columns,
html.youterm-video-fill ytd-watch-flexy #primary,
html.youterm-video-fill ytd-watch-flexy #primary-inner,
html.youterm-video-fill ytd-watch-flexy #player-container-outer,
html.youterm-video-fill ytd-watch-flexy #player-container,
html.youterm-video-fill ytd-watch-flexy #player-container-inner,
html.youterm-video-fill ytd-watch-flexy #player {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  contain: none !important;
  transform: none !important;
  filter: none !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Player fills the viewport */
html.youterm-video-fill #movie_player {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  z-index: 2147483647 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #000 !important;
}

/* Video fills its container */
html.youterm-video-fill .html5-video-container {
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  inset: 0 !important;
}
html.youterm-video-fill video.html5-main-video,
html.youterm-video-fill video.video-stream {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
`.trim()

  async function ensureVideoFillStyle(frame: Electron.WebFrameMain): Promise<void> {
    const cssEscaped = VIDEO_FILL_CSS.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
    try {
      await frame.executeJavaScript(
        `(() => {
          if (document.getElementById('youterm-video-fill-style')) return
          const style = document.createElement('style')
          style.id = 'youterm-video-fill-style'
          style.textContent = \`${cssEscaped}\`
          document.head.appendChild(style)
        })()`,
      )
    } catch {}
  }

  async function applyVideoFillClass(frame: Electron.WebFrameMain, enabled: boolean): Promise<void> {
    try {
      await frame.executeJavaScript(
        `document.documentElement.classList.toggle('youterm-video-fill', ${enabled ? 'true' : 'false'})`,
      )
    } catch {}
  }

  async function applyVideoFillToAllYoutubeFrames(): Promise<void> {
    if (terminalView.webContents.isDestroyed()) return
    const enabled = settings.getSettings().videoFillMode
    const frames = terminalView.webContents.mainFrame.frames
    for (const frame of frames) {
      if (frame.url && /^https:\/\/(?:[a-z0-9-]+\.)*youtube\.com/i.test(frame.url)) {
        await ensureVideoFillStyle(frame)
        await applyVideoFillClass(frame, enabled)
      }
    }
  }

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

  const onFrameFinishLoad = async (_e: unknown, isMainFrame: boolean) => {
    if (isMainFrame) return
    if (disposed) return
    await applyVideoFillToAllYoutubeFrames()
  }
  terminalView.webContents.on('did-frame-finish-load', onFrameFinishLoad)

  // Playback position: every 10s, read video.currentTime from the YouTube frame
  // and append/update &t=<sec> in the persisted URL so we can resume on restart.
  const PLAYBACK_POLL_INTERVAL_MS = 10_000

  const getYoutubeFrame = () => {
    if (terminalView.webContents.isDestroyed()) return null
    const frames = terminalView.webContents.mainFrame.frames
    for (const frame of frames) {
      if (frame.url && /^https:\/\/(?:[a-z0-9-]+\.)*youtube\.com/i.test(frame.url)) {
        return frame
      }
    }
    return null
  }

  const pollPlayback = async () => {
    if (disposed) return
    const frame = getYoutubeFrame()
    if (!frame) return
    try {
      const result = await frame.executeJavaScript(
        `(() => {
          const v = document.querySelector('video')
          if (!v || isNaN(v.currentTime) || v.currentTime < 1) return null
          return { t: Math.floor(v.currentTime), url: window.location.href }
        })()`,
      )
      if (!result || typeof result !== 'object') return
      const { t, url } = result as { t: number; url: string }
      if (!url || typeof url !== 'string') return
      // Only persist YouTube watch URLs (not home, not search). Watch URLs have ?v=
      if (!url.includes('youtube.com') || !/[?&]v=/.test(url)) return
      // Strip existing t= / time_continue= params, then append our t=
      const u = new URL(url)
      u.searchParams.delete('t')
      u.searchParams.delete('time_continue')
      if (t >= 1) u.searchParams.set('t', String(t))
      const finalUrl = u.toString()
      if (finalUrl !== settings.getSettings().youtubeLastUrl) {
        settings.dispatch({ type: 'set-youtube-url', url: finalUrl })
      }
    } catch {
      // Cross-origin access is allowed via webFrameMain.executeJavaScript but may
      // still fail during page transitions or if the iframe isn't YouTube yet.
      // Silent failure is OK; the next poll will retry.
    }
  }

  const pollInterval = setInterval(pollPlayback, PLAYBACK_POLL_INTERVAL_MS)

  let lastAdBlockState = settings.getSettings().adBlockEnabled
  const settingsUnsub = settings.subscribe(async s => {
    if (disposed) return
    void applyVideoFillToAllYoutubeFrames()
    if (s.adBlockEnabled !== lastAdBlockState) {
      lastAdBlockState = s.adBlockEnabled
      await adBlock.setEnabled(s.adBlockEnabled)
      // Reload iframe so filter change takes effect immediately
      if (!terminalView.webContents.isDestroyed()) {
        terminalView.webContents.send('youtube:reload')
      }
    }
  })

  return {
    flushPlayback: pollPlayback,
    dispose() {
      disposed = true
      clearInterval(pollInterval)
      settingsUnsub()
      terminalView.webContents.removeListener('did-frame-navigate', onFrameNavigate)
      terminalView.webContents.removeListener('will-frame-navigate', onWillFrameNavigateWrapper)
      terminalView.webContents.removeListener('did-frame-finish-load', onFrameFinishLoad)
      if (activeLoginWin && !activeLoginWin.isDestroyed()) activeLoginWin.close()
      adBlock.dispose()
    },
  }
}
