import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { ModeController } from './modeController'
import type { SettingsController } from './settingsController'
import type { WindowBundle } from './window'

const STEP = 0.05

export function installShortcuts(
  bundle: WindowBundle,
  ctrl: ModeController,
  settings: SettingsController,
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
      label: 'Mode',
      submenu: [
        {
          label: 'YouTube Only',
          accelerator: 'Cmd+1',
          click: () => ctrl.dispatch({ type: 'set-mode', mode: 'youtube-only' }),
        },
        {
          label: 'Overlay',
          accelerator: 'Cmd+2',
          click: () => ctrl.dispatch({ type: 'set-mode', mode: 'overlay' }),
        },
        {
          label: 'Terminal Only',
          accelerator: 'Cmd+3',
          click: () => ctrl.dispatch({ type: 'set-mode', mode: 'terminal-only' }),
        },
        { type: 'separator' },
        {
          label: 'Toggle Input Target',
          accelerator: 'Cmd+\\',
          click: () => ctrl.dispatch({ type: 'toggle-input-target' }),
        },
      ],
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: togglePanel,
        },
        { type: 'separator' },
        {
          label: 'More Opaque',
          accelerator: 'Cmd+]',
          click: () => adjustTransparency(STEP),
        },
        {
          label: 'More Transparent',
          accelerator: 'Cmd+[',
          click: () => adjustTransparency(-STEP),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload YouTube',
          accelerator: 'Cmd+R',
          click: () => bundle.youtubeView.webContents.reload(),
        },
        {
          label: 'Hard Reload',
          accelerator: 'Cmd+Shift+R',
          click: () => {
            bundle.youtubeView.webContents.reloadIgnoringCache()
            bundle.terminalView.webContents.reloadIgnoringCache()
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
