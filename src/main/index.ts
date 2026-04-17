import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { attachPty, type PtyBridge } from './ipc'
import { createModeController, type ModeController } from './modeController'

let bundle: ReturnType<typeof createMainWindow> | undefined
let ptyBridge: PtyBridge | undefined
let modeCtrl: ModeController | undefined

async function start() {
  bundle = createMainWindow()
  ptyBridge = await attachPty(bundle.terminalView)
  modeCtrl = createModeController(bundle)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bundle = createMainWindow()
      ptyBridge = await attachPty(bundle.terminalView)
      modeCtrl = createModeController(bundle)
    }
  })
}

app.whenReady().then(start)

app.on('window-all-closed', () => {
  ptyBridge?.dispose()
  if (process.platform !== 'darwin') app.quit()
})

export { modeCtrl }
