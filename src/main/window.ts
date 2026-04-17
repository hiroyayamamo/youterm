import { BrowserWindow, WebContentsView, session } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export interface WindowBundle {
  win: BrowserWindow
  youtubeView: WebContentsView
  terminalView: WebContentsView
}

export function createMainWindow(): WindowBundle {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#000000',
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../../index.html'))
  }

  const youtubeSession = session.fromPartition('persist:youtube')
  const youtubeView = new WebContentsView({
    webPreferences: {
      session: youtubeSession,
      preload: join(__dirname, '../preload/youtube.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  youtubeView.webContents.loadURL('https://www.youtube.com/')

  const terminalSession = session.fromPartition('persist:terminal')
  const terminalView = new WebContentsView({
    webPreferences: {
      session: terminalSession,
      preload: join(__dirname, '../preload/terminal.js'),
      contextIsolation: true,
      nodeIntegration: false,
      transparent: true,
    },
  })
  terminalView.setBackgroundColor('#00000000')

  if (process.env.ELECTRON_RENDERER_URL) {
    terminalView.webContents.loadURL(`${process.env.ELECTRON_RENDERER_URL}/terminal/index.html`)
  } else {
    terminalView.webContents.loadFile(join(__dirname, '../renderer/terminal/index.html'))
  }

  win.contentView.addChildView(youtubeView)
  win.contentView.addChildView(terminalView)

  // Minimal initial bounds so the views render before modeController takes over.
  // The ModeController will re-apply proper bounds on construction.
  const { width, height } = win.getContentBounds()
  youtubeView.setBounds({ x: 0, y: 0, width, height })
  terminalView.setBounds({ x: 0, y: 0, width, height })

  // Ensure terminal renderer gets a resize signal after its first load.
  // This fires an Electron resize which the modeController (registered later) will observe.
  terminalView.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      const { width, height } = win.getContentBounds()
      // Trigger a no-op bounds update so ResizeObserver fires in renderer
      terminalView.setBounds({ x: 0, y: 0, width, height })
    }, 50)
  })

  win.once('ready-to-show', () => win.show())
  return { win, youtubeView, terminalView }
}
