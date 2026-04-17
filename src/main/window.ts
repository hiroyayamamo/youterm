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

  const applyBounds = () => {
    const { width, height } = win.getContentBounds()
    youtubeView.setBounds({ x: 0, y: 0, width, height })
    terminalView.setBounds({ x: 0, y: 0, width, height })
  }
  applyBounds()
  win.on('resize', applyBounds)
  // Ensure terminal's FitAddon runs after initial load (applyBounds fires a resize
  // which the renderer's ResizeObserver will pick up).
  terminalView.webContents.once('did-finish-load', () => {
    setTimeout(applyBounds, 50)
  })

  win.once('ready-to-show', () => win.show())
  return { win, youtubeView, terminalView }
}
