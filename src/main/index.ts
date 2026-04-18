import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { attachTabs, attachSettings, type TabsBridge, type SettingsBridge } from './ipc'
import { createModeController, type ModeController } from './modeController'
import { createSettingsController, type SettingsController } from './settingsController'
import { createRealSettingsStore } from './settingsStore'
import { installShortcuts } from './shortcuts'

let bundle: ReturnType<typeof createMainWindow> | undefined
let tabsBridge: TabsBridge | undefined
let settingsBridge: SettingsBridge | undefined
let modeCtrl: ModeController | undefined
let settings: SettingsController | undefined

async function start() {
  bundle = createMainWindow()
  tabsBridge = await attachTabs(bundle.win, bundle.terminalView)

  const store = await createRealSettingsStore()
  settings = createSettingsController({ store })

  modeCtrl = createModeController(bundle, { initialMode: settings.getSettings().lastMode })

  modeCtrl.subscribe(state => {
    if (state.mode !== settings!.getSettings().lastMode) {
      settings!.dispatch({ type: 'set-last-mode', mode: state.mode })
    }
  })

  settingsBridge = attachSettings(bundle.terminalView, settings)
  installShortcuts(bundle, modeCtrl, settings, tabsBridge.tabsController)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bundle = createMainWindow()
      tabsBridge = await attachTabs(bundle.win, bundle.terminalView)
      modeCtrl = createModeController(bundle, { initialMode: settings!.getSettings().lastMode })
      modeCtrl.subscribe(state => {
        if (state.mode !== settings!.getSettings().lastMode) {
          settings!.dispatch({ type: 'set-last-mode', mode: state.mode })
        }
      })
      settingsBridge = attachSettings(bundle.terminalView, settings!)
      installShortcuts(bundle, modeCtrl, settings!, tabsBridge.tabsController)
    }
  })
}

app.whenReady().then(start)

app.on('window-all-closed', () => {
  settingsBridge?.dispose()
  tabsBridge?.dispose()
  if (process.platform !== 'darwin') app.quit()
})

export { modeCtrl, settings }
