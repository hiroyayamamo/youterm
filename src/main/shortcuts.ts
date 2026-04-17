import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { ModeController } from './modeController'
import type { WindowBundle } from './window'

export function installShortcuts(bundle: WindowBundle, ctrl: ModeController): void {
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
