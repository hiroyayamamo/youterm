import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { attachPty, type PtyBridge } from './ipc'

let bundle: ReturnType<typeof createMainWindow> | undefined
let ptyBridge: PtyBridge | undefined

async function start() {
  bundle = createMainWindow()
  ptyBridge = await attachPty(bundle.terminalView)
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bundle = createMainWindow()
      ptyBridge = await attachPty(bundle.terminalView)
    }
  })
}

app.whenReady().then(start)

app.on('window-all-closed', () => {
  ptyBridge?.dispose()
  if (process.platform !== 'darwin') app.quit()
})
