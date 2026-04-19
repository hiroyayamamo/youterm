import { BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export interface WindowBundle {
  win: BrowserWindow
}

export function createMainWindow(): WindowBundle {
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

  // Terminal + YouTube iframe load directly into the BrowserWindow's root
  // webContents (no WebContentsView). This matters for Finder drag-and-drop:
  // on Electron 32 + macOS, native drops hit the BrowserWindow's webContents,
  // and a child WebContentsView did not see them — flattening the hierarchy
  // removes the routing ambiguity entirely.
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#000000',
    transparent: true,
    webPreferences: {
      session: terminalSession,
      preload: join(__dirname, '../preload/terminal.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Prevent Electron from auto-syncing window title with HTML <title>;
  // main process controls title dynamically (e.g., based on active tab).
  win.webContents.on('page-title-updated', event => {
    event.preventDefault()
  })
  win.setTitle('Uterm')

  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.loadURL(`${process.env.ELECTRON_RENDERER_URL}/terminal/index.html`)
  } else {
    win.webContents.loadFile(join(__dirname, '../renderer/terminal/index.html'))
  }

  // Belt-and-suspenders: if anything (Finder drop, link click) tries to
  // navigate the window to a file:// URL, cancel it so the terminal page
  // is never replaced by arbitrary content.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) event.preventDefault()
  })

  win.once('ready-to-show', () => win.show())
  return { win }
}
