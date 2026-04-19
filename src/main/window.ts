import { BrowserWindow, WebContentsView, session } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export interface WindowBundle {
  win: BrowserWindow
  terminalView: WebContentsView
}

export function createMainWindow(): WindowBundle {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#000000',
  })

  // Prevent Electron from auto-syncing window title with HTML <title>;
  // main process controls title dynamically (e.g., based on active tab).
  win.webContents.on('page-title-updated', event => {
    event.preventDefault()
  })
  win.setTitle('Uterm')

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../../index.html'))
  }

  // If a Finder drop ever reaches the root BrowserWindow's webContents (which
  // has no preload), Chromium's default is to navigate the frame to the
  // dropped file:// URL. Block that so the drop is simply ignored here and
  // the preload handler on the WebContentsView can own the interaction.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) event.preventDefault()
  })

  const terminalSession = session.fromPartition('persist:terminal')

  // Allow YouTube iframe embedding: strip X-Frame-Options / frame-ancestors
  // for youtube/google media domains. Scoped so other requests keep protections.
  const YOUTUBE_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'googlevideo.com',
    'ytimg.com',
    'googleusercontent.com',
    'doubleclick.net',
    'google.com',
    'gstatic.com',
  ]
  const isYoutubeHost = (url: string): boolean => {
    try {
      const host = new URL(url).hostname
      return YOUTUBE_DOMAINS.some(d => host === d || host.endsWith('.' + d))
    } catch {
      return false
    }
  }
  terminalSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isYoutubeHost(details.url)) {
      callback({})
      return
    }
    const h = details.responseHeaders || {}
    const newHeaders: Record<string, string[]> = {}
    for (const k of Object.keys(h)) {
      const lower = k.toLowerCase()
      if (lower === 'x-frame-options') continue
      if (lower === 'content-security-policy') {
        const v = Array.isArray(h[k]) ? h[k] : [h[k] as unknown as string]
        newHeaders[k] = (v as string[]).map(s =>
          s.replace(/frame-ancestors[^;]*;?/gi, '').trim(),
        )
        continue
      }
      newHeaders[k] = h[k] as string[]
    }
    callback({ responseHeaders: newHeaders })
  })

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

  // Same defense as above: if a drop's default file:// navigation survives
  // past the preload handler, cancel it in main so we don't accidentally
  // replace the terminal page with the dropped file's contents.
  terminalView.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) event.preventDefault()
  })

  win.contentView.addChildView(terminalView)

  const applyBounds = () => {
    const { width, height } = win.getContentBounds()
    terminalView.setBounds({ x: 0, y: 0, width, height })
  }
  applyBounds()
  win.on('resize', applyBounds)

  terminalView.webContents.once('did-finish-load', () => {
    setTimeout(applyBounds, 50)
  })

  win.once('ready-to-show', () => win.show())
  return { win, terminalView }
}
