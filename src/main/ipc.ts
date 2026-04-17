import { ipcMain, type WebContentsView } from 'electron'
import os from 'node:os'
import { createPtyHandle, createRealPtySpawn, type PtyHandle } from './pty'
import type { SettingsController } from './settingsController'
import type { Settings, ColorKey } from '../shared/types'

export interface PtyBridge {
  ptyHandle: PtyHandle
  dispose(): void
}

export async function attachPty(terminalView: WebContentsView): Promise<PtyBridge> {
  const spawn = await createRealPtySpawn()
  const ptyHandle = createPtyHandle({
    spawn,
    cwd: os.homedir(),
    env: process.env,
  })

  ptyHandle.onData(data => {
    if (!terminalView.webContents.isDestroyed()) {
      terminalView.webContents.send('pty:data', data)
    }
  })

  const onWrite = (_e: unknown, data: string) => ptyHandle.write(data)
  const onResize = (_e: unknown, size: { cols: number; rows: number }) =>
    ptyHandle.resize(size.cols, size.rows)

  ipcMain.on('pty:write', onWrite)
  ipcMain.on('pty:resize', onResize)

  return {
    ptyHandle,
    dispose() {
      ipcMain.removeListener('pty:write', onWrite)
      ipcMain.removeListener('pty:resize', onResize)
      ptyHandle.kill()
    },
  }
}

const VALID_COLORS: ColorKey[] = ['black', 'dark-gray', 'dark-blue', 'dark-green']

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
