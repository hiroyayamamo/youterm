import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { ModeController } from './modeController'
import type { SettingsController } from './settingsController'
import type { TabsController } from './tabsController'
import type { WindowBundle } from './window'
import type { YoutubeBridge } from './ipc'

const STEP = 0.05

export function installShortcuts(
  bundle: WindowBundle,
  ctrl: ModeController,
  settings: SettingsController,
  tabs: TabsController,
  youtube: YoutubeBridge,
): void {
  const adjustTransparency = (delta: number) => {
    const current = settings.getSettings().transparency
    settings.dispatch({ type: 'set-transparency', value: current + delta })
  }

  const togglePanel = () => {
    if (ctrl.getState().mode === 'youtube-only') {
      ctrl.dispatch({ type: 'set-mode', mode: 'overlay' })
    }
    if (!bundle.win.webContents.isDestroyed()) {
      bundle.win.webContents.send('panel:toggle')
    }
  }

  const cycleTab = (direction: 1 | -1) => {
    const s = tabs.getState()
    const idx = s.tabs.findIndex(t => t.id === s.activeId)
    if (idx < 0) return
    const next = (idx + direction + s.tabs.length) % s.tabs.length
    tabs.activateTab(s.tabs[next].id)
  }

  const closeActiveTab = async () => {
    const s = tabs.getState()
    const result = await tabs.closeTab(s.activeId)
    if (result === 'close-window') bundle.win.close()
  }

  const toggleVideoPlayback = async () => {
    const tv = bundle.win
    if (tv.webContents.isDestroyed()) return
    const frames = tv.webContents.mainFrame.frames
    for (const frame of frames) {
      if (frame.url && /^https:\/\/(?:[a-z0-9-]+\.)*youtube\.com/i.test(frame.url)) {
        try {
          await frame.executeJavaScript(`(() => {
            const v = document.querySelector('video.html5-main-video') ||
                      document.querySelector('video.video-stream') ||
                      document.querySelector('video')
            if (!v) return
            if (v.paused) {
              v.play().catch(() => {})
            } else {
              v.pause()
            }
          })()`)
        } catch {}
        break
      }
    }
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'youterm',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Tab',
      submenu: [
        { label: 'New Tab', accelerator: 'Cmd+T', click: () => tabs.newTab() },
        { label: 'Close Tab', accelerator: 'Cmd+W', click: () => { void closeActiveTab() } },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => cycleTab(1) },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => cycleTab(-1) },
        { label: 'Next Tab (alt)', accelerator: 'Cmd+Shift+]', click: () => cycleTab(1) },
        { label: 'Previous Tab (alt)', accelerator: 'Cmd+Shift+[', click: () => cycleTab(-1) },
      ],
    },
    {
      label: 'Mode',
      submenu: [
        { label: 'YouTube Only', accelerator: 'Cmd+1', click: () => ctrl.dispatch({ type: 'set-mode', mode: 'youtube-only' }) },
        { label: 'Overlay', accelerator: 'Cmd+2', click: () => ctrl.dispatch({ type: 'set-mode', mode: 'overlay' }) },
        { label: 'Terminal Only', accelerator: 'Cmd+3', click: () => ctrl.dispatch({ type: 'set-mode', mode: 'terminal-only' }) },
        { type: 'separator' },
        { label: 'Toggle Input Target', accelerator: 'Cmd+\\', click: () => ctrl.dispatch({ type: 'toggle-input-target' }) },
      ],
    },
    {
      label: 'Settings',
      submenu: [
        { label: 'Preferences', accelerator: 'Cmd+,', click: togglePanel },
        { type: 'separator' },
        { label: 'More Opaque', accelerator: 'Cmd+]', click: () => adjustTransparency(STEP) },
        { label: 'More Transparent', accelerator: 'Cmd+[', click: () => adjustTransparency(-STEP) },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Play/Pause Video',
          accelerator: 'Cmd+K',
          click: () => { void toggleVideoPlayback() },
        },
        { type: 'separator' },
        {
          label: 'Video Fill',
          accelerator: 'Cmd+Shift+F',
          click: () => {
            if (ctrl.getState().mode !== 'youtube-only') return
            const current = settings.getSettings().videoFillMode
            settings.dispatch({ type: 'set-video-fill', value: !current })
          },
        },
        { type: 'separator' },
        { label: 'Reload YouTube', accelerator: 'Cmd+R', click: () => { void youtube.reloadAdBlockAndIframe() } },
        { label: 'Hard Reload', accelerator: 'Cmd+Shift+R', click: () => bundle.win.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'Cmd+Alt+I',
          click: () => {
            const wc = bundle.win.webContents
            if (wc.isDevToolsOpened()) wc.closeDevTools()
            else wc.openDevTools({ mode: 'detach' })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
