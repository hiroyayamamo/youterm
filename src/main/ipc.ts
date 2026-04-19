import { app, ipcMain, dialog, Menu, MenuItem, BrowserWindow, type WebContentsView } from 'electron'
import os from 'node:os'
import fs from 'node:fs'
import { exec } from 'node:child_process'
import { createRealPtySpawn, type PtyHandle, type PtySpawn } from './pty'
import type { TabsController } from './tabsController'
import { createTabsController } from './tabsController'
import { createRealTabsStore } from './tabsStore'
import type { SettingsController } from './settingsController'
import { createAdBlockController } from './adBlock'
import { buildSplash } from './splash'
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

  const spawnPtyWithPid = (tabId: string, tabCwd: string | null): PtyHandle => {
    // Use tab's stored cwd if it's a valid existing directory, else fall back to homedir
    let cwd = os.homedir()
    if (tabCwd && typeof tabCwd === 'string') {
      try {
        const stats = fs.statSync(tabCwd)
        if (stats.isDirectory()) cwd = tabCwd
      } catch {
        // Directory doesn't exist or unreadable, stick with homedir
      }
    }
    const rawPty = spawn('/bin/zsh', ['-l'], {
      cwd,
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
      getPid: () => {
        const pid = (rawPty as unknown as { pid?: number }).pid
        return typeof pid === 'number' ? pid : null
      },
    }
  }

  const getCwdForPid = (pid: number): Promise<string | null> => {
    return new Promise(resolve => {
      exec(`lsof -a -d cwd -p ${pid} -Fn`, (err, stdout) => {
        if (err) { resolve(null); return }
        // lsof -Fn output format:
        //   p<pid>
        //   f<fd-num>
        //   n<path>
        const match = stdout.match(/^n(.+)$/m)
        if (match && match[1]) {
          resolve(match[1].trim())
        } else {
          resolve(null)
        }
      })
    })
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

  // Startup splash: send ASCII art to each spawned tab, buffered until the
  // renderer signals it's ready (renderer must register onPtyData before splash arrives).
  const splash = buildSplash(app.getVersion())
  let rendererReady = false
  const pendingSplashTabs: string[] = []

  const flushPendingSplashes = () => {
    if (terminalView.webContents.isDestroyed()) return
    for (const tabId of pendingSplashTabs) {
      terminalView.webContents.send('pty:data', { tabId, data: splash })
    }
    pendingSplashTabs.length = 0
  }

  const sendSplashForTab = (tabId: string) => {
    if (rendererReady) {
      if (!terminalView.webContents.isDestroyed()) {
        terminalView.webContents.send('pty:data', { tabId, data: splash })
      }
    } else {
      pendingSplashTabs.push(tabId)
    }
  }

  const handleTerminalReady = () => {
    rendererReady = true
    flushPendingSplashes()
  }
  ipcMain.handle('terminal:ready', handleTerminalReady)

  // If renderer reloads (e.g., Cmd+Shift+R), reset ready state so new init cycle re-sends splash
  const onDidStartLoading = () => {
    rendererReady = false
  }
  terminalView.webContents.on('did-start-loading', onDidStartLoading)

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
    getCwdForPid,
    onSpawn: sendSplashForTab,
  })

  const broadcastState = () => {
    if (!terminalView.webContents.isDestroyed()) {
      terminalView.webContents.send('tabs:state', tabsController.getState())
    }
  }
  tabsController.subscribe(broadcastState)

  // Dynamic window title: "Uterm - {active tab name}"
  const updateWindowTitle = () => {
    if (win.isDestroyed()) return
    const s = tabsController.getState()
    const active = s.tabs.find(t => t.id === s.activeId)
    const name = active?.customName ?? 'zsh'
    win.setTitle(`Uterm - ${name}`)
  }
  const titleUnsub = tabsController.subscribe(updateWindowTitle)
  updateWindowTitle() // Initial title

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
      titleUnsub()
      ipcMain.removeListener('tabs:new', onNew)
      ipcMain.removeListener('tabs:close', onClose)
      ipcMain.removeListener('tabs:activate', onActivate)
      ipcMain.removeListener('tabs:rename', onRename)
      ipcMain.removeListener('pty:write', onWrite)
      ipcMain.removeListener('pty:resize', onResize)
      ipcMain.removeListener('tabs:context-menu', onContextMenu)
      ipcMain.removeHandler('tabs:get-initial')
      ipcMain.removeHandler('terminal:ready')
      if (!terminalView.webContents.isDestroyed()) {
        terminalView.webContents.removeListener('did-start-loading', onDidStartLoading)
      }
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

  const AD_STRIP_SCRIPT = `
(() => {
  if (window.__youtermAdStripInstalled) return
  window.__youtermAdStripInstalled = true

  const AD_FIELDS = ['playerAds', 'adPlacements', 'adSlots', 'adBreakHeartbeatParams', 'adBreakParams']
  const stripAds = (obj) => {
    if (!obj || typeof obj !== 'object') return obj
    for (const f of AD_FIELDS) { if (f in obj) delete obj[f] }
    return obj
  }

  const isPlayerApi = (url) => {
    if (typeof url !== 'string') return false
    return url.includes('/youtubei/v1/player') ||
           url.includes('/get_video_info')
  }

  const origFetch = window.fetch
  window.fetch = function(...args) {
    const input = args[0]
    const url = typeof input === 'string' ? input : (input && input.url)
    if (!isPlayerApi(url)) return origFetch.apply(this, args)
    return origFetch.apply(this, args).then(async (response) => {
      if (!response || !response.ok) return response
      try {
        const text = await response.clone().text()
        const data = JSON.parse(text)
        stripAds(data)
        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      } catch {
        return response
      }
    })
  }

  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__youtermUrl = url
    return origOpen.apply(this, [method, url, ...rest])
  }

  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function(...args) {
    if (isPlayerApi(this.__youtermUrl)) {
      this.addEventListener('load', () => {
        try {
          const data = JSON.parse(this.responseText)
          stripAds(data)
          const modified = JSON.stringify(data)
          Object.defineProperty(this, 'responseText', { configurable: true, get: () => modified })
          Object.defineProperty(this, 'response', { configurable: true, get: () => modified })
        } catch {}
      })
    }
    return origSend.apply(this, args)
  }

  // DOM-level ad skip: detect #movie_player.ad-showing and skip via button or fast-forward
  const aggressiveClick = (el) => {
    try { el.click() } catch {}
    try {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const opts = { bubbles: true, cancelable: true, view: window, button: 0, clientX: cx, clientY: cy }
      el.dispatchEvent(new MouseEvent('pointerdown', opts))
      el.dispatchEvent(new MouseEvent('mousedown', opts))
      el.dispatchEvent(new MouseEvent('pointerup', opts))
      el.dispatchEvent(new MouseEvent('mouseup', opts))
      el.dispatchEvent(new MouseEvent('click', opts))
    } catch {}
  }

  const isVisible = (el) => {
    if (!el) return false
    if (el.offsetParent === null) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0
  }

  const findExplicitSkipButton = () => {
    const selectors = [
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button',
      '.ytp-skip-ad-button',
      'button.ytp-ad-skip-button',
      'button.ytp-skip-ad-button',
      'button.ytp-ad-skip-button-modern',
      'button[class*="ad-skip-button"]',
      'button[class*="skip-ad-button"]',
      'button[class*="ytp-skip-ad"]',
      'button[class*="ytp-ad-skip"]',
    ]
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel)
      for (const el of nodes) {
        if (isVisible(el)) return el
      }
    }
    return null
  }

  const skipAdIfPresent = () => {
    const player = document.querySelector('#movie_player')
    if (!player) return
    // Strict ad detection: only YouTube's own state classes on #movie_player
    const isAd = player.classList.contains('ad-showing') ||
                 player.classList.contains('ad-interrupting')
    if (!isAd) return
    // Prefer explicit skip button
    const skipBtn = findExplicitSkipButton()
    if (skipBtn) {
      aggressiveClick(skipBtn)
      return
    }
    // Fast-forward only if no skip button (fallback, same as v0.7.4)
    const video = document.querySelector('video.html5-main-video') ||
                  document.querySelector('video.video-stream') ||
                  document.querySelector('video')
    if (video && !isNaN(video.duration) && video.duration > 0 && isFinite(video.duration)) {
      try {
        video.currentTime = video.duration
        video.muted = true
      } catch {}
    }
  }

  // Run skip check frequently while ads are showing
  setInterval(skipAdIfPresent, 250)

  // Also observe DOM mutations for class changes
  try {
    const observer = new MutationObserver(skipAdIfPresent)
    const startObserving = () => {
      const player = document.querySelector('#movie_player')
      if (player) {
        observer.observe(player, { attributes: true, attributeFilter: ['class'] })
      } else {
        // Retry until player exists
        setTimeout(startObserving, 500)
      }
    }
    startObserving()
  } catch {}

  // Pause video on FIRST play after app startup (runs once per iframe lifetime)
  if (!window.__youtermInitialPauseScheduled) {
    window.__youtermInitialPauseScheduled = true
    let initialPauseDone = false

    const attachPauseOnce = (video) => {
      if (!video) return
      const onPlay = () => {
        if (initialPauseDone) return
        try { video.pause() } catch {}
        initialPauseDone = true
        video.removeEventListener('play', onPlay)
        video.removeEventListener('playing', onPlay)
      }
      video.addEventListener('play', onPlay)
      video.addEventListener('playing', onPlay)
    }

    const pollForVideo = () => {
      if (initialPauseDone) return
      const video = document.querySelector('video.html5-main-video') ||
                    document.querySelector('video.video-stream') ||
                    document.querySelector('video')
      if (video) {
        attachPauseOnce(video)
      }
    }

    // Try immediately
    pollForVideo()
    // Retry for 30 seconds in case video element is created after script runs
    const retryInterval = setInterval(() => {
      if (initialPauseDone) { clearInterval(retryInterval); return }
      pollForVideo()
    }, 300)
    setTimeout(() => clearInterval(retryInterval), 30000)
  }
})()
`.trim()

  async function injectAdStrip(frame: Electron.WebFrameMain): Promise<void> {
    try {
      await frame.executeJavaScript(AD_STRIP_SCRIPT)
    } catch {}
  }

  // CDP-based installer: script runs in EVERY document (incl. iframes) at document-start,
  // before any page JS. Catches the initial /youtubei/v1/player call on first load.
  let adStripScriptId: string | null = null

  const installAdStripViaCDP = async (): Promise<void> => {
    try {
      if (!terminalView.webContents.debugger.isAttached()) {
        terminalView.webContents.debugger.attach('1.3')
      }
      await terminalView.webContents.debugger.sendCommand('Page.enable')
      const result = await terminalView.webContents.debugger.sendCommand(
        'Page.addScriptToEvaluateOnNewDocument',
        { source: AD_STRIP_SCRIPT },
      )
      adStripScriptId = (result as { identifier?: string }).identifier ?? null
    } catch (err) {
      console.error('[adStrip] CDP install failed:', err)
    }
  }

  const uninstallAdStripViaCDP = async (): Promise<void> => {
    if (!adStripScriptId) return
    try {
      await terminalView.webContents.debugger.sendCommand(
        'Page.removeScriptToEvaluateOnNewDocument',
        { identifier: adStripScriptId },
      )
    } catch (err) {
      console.error('[adStrip] CDP uninstall failed:', err)
    }
    adStripScriptId = null
  }

  // Additional layer: CDP Fetch domain intercepts /youtubei/v1/player* responses
  // at the network layer. This catches initial-load ads that script injection timing misses.
  const AD_FIELDS_TO_STRIP = ['playerAds', 'adPlacements', 'adSlots', 'adBreakHeartbeatParams', 'adBreakParams']
  let fetchInterceptEnabled = false
  let debuggerMessageListener: ((event: Electron.Event, method: string, params: Record<string, unknown>) => void) | null = null

  const stripAdsFromBody = (raw: string): string | null => {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      let modified = false
      for (const f of AD_FIELDS_TO_STRIP) {
        if (f in data) {
          delete data[f]
          modified = true
        }
      }
      if (!modified) return null
      return JSON.stringify(data)
    } catch {
      return null
    }
  }

  const handleFetchRequestPaused = async (params: Record<string, unknown>) => {
    const dbg = terminalView.webContents.debugger
    const reqId = params.requestId as string
    const responseStatusCode = params.responseStatusCode as number | undefined
    if (!responseStatusCode) {
      // Request stage (shouldn't happen since we set requestStage: 'Response', but be safe)
      try { await dbg.sendCommand('Fetch.continueRequest', { requestId: reqId }) } catch {}
      return
    }
    try {
      const bodyResult = await dbg.sendCommand('Fetch.getResponseBody', { requestId: reqId }) as { body: string; base64Encoded: boolean }
      const raw = bodyResult.base64Encoded
        ? Buffer.from(bodyResult.body, 'base64').toString('utf-8')
        : bodyResult.body
      const modified = stripAdsFromBody(raw)
      if (!modified) {
        // No ad fields found; pass through unmodified
        await dbg.sendCommand('Fetch.continueResponse', { requestId: reqId })
        return
      }
      const modifiedBase64 = Buffer.from(modified, 'utf-8').toString('base64')
      // Rebuild headers, drop Content-Length and Content-Encoding (body is unencoded now)
      const origHeaders = (params.responseHeaders as Array<{ name: string; value: string }> | undefined) ?? []
      const newHeaders = origHeaders
        .filter(h => {
          const n = h.name.toLowerCase()
          return n !== 'content-length' && n !== 'content-encoding'
        })
        .concat([{ name: 'Content-Length', value: String(Buffer.byteLength(modified)) }])
      await dbg.sendCommand('Fetch.fulfillRequest', {
        requestId: reqId,
        responseCode: responseStatusCode,
        responseHeaders: newHeaders,
        body: modifiedBase64,
      })
    } catch {
      try { await dbg.sendCommand('Fetch.continueResponse', { requestId: reqId }) } catch {}
    }
  }

  const installFetchIntercept = async (): Promise<void> => {
    if (fetchInterceptEnabled) return
    try {
      const dbg = terminalView.webContents.debugger
      if (!dbg.isAttached()) dbg.attach('1.3')
      await dbg.sendCommand('Fetch.enable', {
        patterns: [
          { urlPattern: 'https://www.youtube.com/youtubei/v1/player*', requestStage: 'Response' },
          { urlPattern: 'https://m.youtube.com/youtubei/v1/player*', requestStage: 'Response' },
        ],
      })
      debuggerMessageListener = (_event, method, params) => {
        if (method === 'Fetch.requestPaused') {
          void handleFetchRequestPaused(params as Record<string, unknown>)
        }
      }
      dbg.on('message', debuggerMessageListener)
      fetchInterceptEnabled = true
    } catch (err) {
      console.error('[adStrip] CDP Fetch intercept install failed:', err)
    }
  }

  const uninstallFetchIntercept = async (): Promise<void> => {
    if (!fetchInterceptEnabled) return
    const dbg = terminalView.webContents.debugger
    try {
      if (debuggerMessageListener) {
        dbg.removeListener('message', debuggerMessageListener)
        debuggerMessageListener = null
      }
      await dbg.sendCommand('Fetch.disable')
    } catch (err) {
      console.error('[adStrip] CDP Fetch intercept uninstall failed:', err)
    }
    fetchInterceptEnabled = false
  }

  if (settings.getSettings().adBlockEnabled) {
    await installAdStripViaCDP()
    await installFetchIntercept()
  }

  async function applyVideoFillToAllYoutubeFrames(): Promise<void> {
    if (terminalView.webContents.isDestroyed()) return
    const enabled = settings.getSettings().videoFillMode
    const adBlockEnabled = settings.getSettings().adBlockEnabled
    const frames = terminalView.webContents.mainFrame.frames
    for (const frame of frames) {
      if (frame.url && /^https:\/\/(?:[a-z0-9-]+\.)*youtube\.com/i.test(frame.url)) {
        await ensureVideoFillStyle(frame)
        await applyVideoFillClass(frame, enabled)
        if (adBlockEnabled) {
          await injectAdStrip(frame)
        }
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
      if (s.adBlockEnabled) {
        await installAdStripViaCDP()
        await installFetchIntercept()
      } else {
        await uninstallAdStripViaCDP()
        await uninstallFetchIntercept()
      }
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
      // CDP cleanup
      if (debuggerMessageListener) {
        try {
          terminalView.webContents.debugger.removeListener('message', debuggerMessageListener)
        } catch {}
        debuggerMessageListener = null
      }
      try {
        if (terminalView.webContents.debugger.isAttached()) {
          terminalView.webContents.debugger.detach()
        }
      } catch {}
    },
  }
}
