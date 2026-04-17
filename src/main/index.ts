import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { attachPty, attachSettings, type PtyBridge, type SettingsBridge } from './ipc'
import { createModeController, type ModeController } from './modeController'
import { createSettingsController, type SettingsController } from './settingsController'
import { createRealSettingsStore } from './settingsStore'
import { installShortcuts } from './shortcuts'

let bundle: ReturnType<typeof createMainWindow> | undefined
let ptyBridge: PtyBridge | undefined
let settingsBridge: SettingsBridge | undefined
let modeCtrl: ModeController | undefined
let settings: SettingsController | undefined

async function start() {
  bundle = createMainWindow()
  ptyBridge = await attachPty(bundle.terminalView)

  const store = await createRealSettingsStore()
  settings = createSettingsController({ store })

  modeCtrl = createModeController(bundle, { initialMode: settings.getSettings().lastMode })

  // Persist mode changes
  modeCtrl.subscribe(state => {
    if (state.mode !== settings!.getSettings().lastMode) {
      settings!.dispatch({ type: 'set-last-mode', mode: state.mode })
    }
  })

  settingsBridge = attachSettings(bundle.terminalView, settings)
  installShortcuts(bundle, modeCtrl)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bundle = createMainWindow()
      ptyBridge = await attachPty(bundle.terminalView)
      modeCtrl = createModeController(bundle, { initialMode: settings!.getSettings().lastMode })
      modeCtrl.subscribe(state => {
        if (state.mode !== settings!.getSettings().lastMode) {
          settings!.dispatch({ type: 'set-last-mode', mode: state.mode })
        }
      })
      settingsBridge = attachSettings(bundle.terminalView, settings!)
      installShortcuts(bundle, modeCtrl)
    }
  })
}

app.whenReady().then(start)

app.on('window-all-closed', () => {
  settingsBridge?.dispose()
  ptyBridge?.dispose()
  if (process.platform !== 'darwin') app.quit()
})

export { modeCtrl, settings }
