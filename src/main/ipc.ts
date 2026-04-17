import { ipcMain, type WebContentsView } from 'electron'
import os from 'node:os'
import { createPtyHandle, createRealPtySpawn, type PtyHandle } from './pty'

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
