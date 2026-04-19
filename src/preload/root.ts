import { ipcRenderer, webUtils } from 'electron'

// Root BrowserWindow preload. The actual terminal + YouTube UI lives in a
// child WebContentsView, but in Electron 32 native Finder drops still hit
// the root window's webContents (not the child view), so we MUST handle
// them here. Without this, dropped files would fall through to Chromium's
// default `file://` navigation and macOS would reject the drop (the file
// bounces back to its origin in Finder).
console.log('[youterm-dnd-root] preload loaded, webUtils type:', typeof webUtils)

const shellQuote = (p: string): string => `'${p.replace(/'/g, "'\\''")}'`

const preventDefault = (e: DragEvent) => {
  if (!e.dataTransfer) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}
document.addEventListener('dragenter', e => {
  console.log('[youterm-dnd-root] dragenter, types:', e.dataTransfer && Array.from(e.dataTransfer.types))
  preventDefault(e)
}, true)
document.addEventListener('dragover', preventDefault, true)

document.addEventListener('drop', e => {
  console.log('[youterm-dnd-root] drop fired, files:', e.dataTransfer?.files.length)
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const parts: string[] = []
  for (const file of Array.from(files)) {
    try {
      const p = webUtils.getPathForFile(file)
      console.log('[youterm-dnd-root] resolved path:', p, 'for file:', file.name)
      if (p) parts.push(shellQuote(p))
    } catch (err) {
      console.error('[youterm-dnd-root] getPathForFile threw:', err)
    }
  }
  if (parts.length === 0) return
  const payload = parts.join(' ') + ' '
  console.log('[youterm-dnd-root] sending dnd:drop', payload.length, 'bytes')
  ipcRenderer.send('dnd:drop', payload)
}, true)
