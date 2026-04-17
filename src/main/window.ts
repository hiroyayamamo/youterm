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

  // Allow YouTube (and its iframe subresources) to be embedded in an iframe inside
  // the terminal renderer by stripping X-Frame-Options and frame-ancestors CSP.
  // Scoped to youtube / google media domains so other sites keep their protections.
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
