import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'

let bundle: ReturnType<typeof createMainWindow> | undefined

app.whenReady().then(() => {
  bundle = createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) bundle = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
