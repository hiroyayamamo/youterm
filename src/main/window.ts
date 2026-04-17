import { BrowserWindow, WebContentsView, session } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export interface WindowBundle {
  win: BrowserWindow
  youtubeView: WebContentsView
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

  win.contentView.addChildView(youtubeView)

  const applyBounds = () => {
    const { width, height } = win.getContentBounds()
    youtubeView.setBounds({ x: 0, y: 0, width, height })
  }
  applyBounds()
  win.on('resize', applyBounds)

  win.once('ready-to-show', () => win.show())
  return { win, youtubeView }
}
