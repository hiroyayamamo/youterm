import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { ModeController } from './modeController'
import type { SettingsController } from './settingsController'
import type { TabsController } from './tabsController'
import type { WindowBundle } from './window'

const STEP = 0.05

export function installShortcuts(
  bundle: WindowBundle,
  ctrl: ModeController,
  settings: SettingsController,
  tabs: TabsController,
): void {
  const adjustTransparency = (delta: number) => {
    const current = settings.getSettings().transparency
    settings.dispatch({ type: 'set-transparency', value: current + delta })
  }

  const togglePanel = () => {
    if (ctrl.getState().mode === 'youtube-only') {
      ctrl.dispatch({ type: 'set-mode', mode: 'overlay' })
    }
    if (!bundle.terminalView.webContents.isDestroyed()) {
      bundle.terminalView.webContents.send('panel:toggle')
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
          label: 'Video Fill',
          accelerator: 'Cmd+Shift+F',
          click: () => {
            const current = settings.getSettings().videoFillMode
            settings.dispatch({ type: 'set-video-fill', value: !current })
          },
        },
        { type: 'separator' },
        { label: 'Reload YouTube', accelerator: 'Cmd+R', click: () => {
          if (!bundle.terminalView.webContents.isDestroyed()) {
            bundle.terminalView.webContents.send('youtube:reload')
          }
        }},
        { label: 'Hard Reload', accelerator: 'Cmd+Shift+R', click: () => bundle.terminalView.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
