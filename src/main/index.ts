import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './window'
import { attachTabs, attachSettings, attachYoutube, type TabsBridge, type SettingsBridge, type YoutubeBridge } from './ipc'
import { createModeController, type ModeController } from './modeController'
import { createSettingsController, type SettingsController } from './settingsController'
import { createRealSettingsStore } from './settingsStore'
import { installShortcuts } from './shortcuts'

// Disable Chromium third-party storage partitioning so the YouTube iframe shares
// cookies/localStorage with the session jar. Required for YouTube preferences
// (dark mode, theater mode, PREF cookie) to persist across app restarts.
app.commandLine.appendSwitch('disable-features', 'ThirdPartyStoragePartitioning,PartitionedCookies')

let bundle: ReturnType<typeof createMainWindow> | undefined
let tabsBridge: TabsBridge | undefined
let settingsBridge: SettingsBridge | undefined
let youtubeBridge: YoutubeBridge | undefined
let modeCtrl: ModeController | undefined
let settings: SettingsController | undefined

async function start() {
  bundle = createMainWindow()
  tabsBridge = await attachTabs(bundle.win, bundle.terminalView)

  const store = await createRealSettingsStore()
  settings = createSettingsController({ store })

  modeCtrl = createModeController(bundle, { initialMode: settings.getSettings().lastMode })

  // Register one-time (idempotent) handler for renderer to pull initial state.
  // Closure reads via module-level `modeCtrl` so the latest instance is always used.
  ipcMain.removeHandler('state:get-initial')
  ipcMain.handle('state:get-initial', () => modeCtrl!.getState())

  modeCtrl.subscribe(state => {
    if (state.mode !== settings!.getSettings().lastMode) {
      settings!.dispatch({ type: 'set-last-mode', mode: state.mode })
    }
  })

  settingsBridge = attachSettings(bundle.terminalView, settings)
  youtubeBridge = await attachYoutube(bundle.win, bundle.terminalView, settings)
  installShortcuts(bundle, modeCtrl, settings, tabsBridge.tabsController, youtubeBridge)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bundle = createMainWindow()
      tabsBridge = await attachTabs(bundle.win, bundle.terminalView)
      modeCtrl = createModeController(bundle, { initialMode: settings!.getSettings().lastMode })
      ipcMain.removeHandler('state:get-initial')
      ipcMain.handle('state:get-initial', () => modeCtrl!.getState())
      modeCtrl.subscribe(state => {
        if (state.mode !== settings!.getSettings().lastMode) {
          settings!.dispatch({ type: 'set-last-mode', mode: state.mode })
        }
      })
      settingsBridge = attachSettings(bundle.terminalView, settings!)
      youtubeBridge = await attachYoutube(bundle.win, bundle.terminalView, settings!)
      installShortcuts(bundle, modeCtrl, settings!, tabsBridge.tabsController, youtubeBridge)
    }
  })
}

app.whenReady().then(start)

app.on('window-all-closed', () => {
  youtubeBridge?.dispose()
  settingsBridge?.dispose()
  tabsBridge?.dispose()
  if (process.platform !== 'darwin') app.quit()
})

let quitting = false
app.on('before-quit', async event => {
  if (quitting) return
  const hasWork = !!youtubeBridge || !!tabsBridge
  if (!hasWork) return
  event.preventDefault()
  quitting = true
  try {
    if (tabsBridge) await tabsBridge.tabsController.captureCwds()
  } catch {}
  try {
    if (youtubeBridge) await youtubeBridge.flushPlayback()
  } catch {}
  app.quit()
})

export { modeCtrl, settings }
