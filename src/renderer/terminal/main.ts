import { mountTerminal } from './terminal'
import { createModeIndicator } from './modeIndicator'
import type { Settings } from '../../shared/types'
import { COLOR_VALUES } from '../../shared/types'

function applySettingsToCSS(s: Settings): void {
  const { r, g, b } = COLOR_VALUES[s.bgColor]
  const root = document.documentElement.style
  root.setProperty('--term-bg-r', String(r))
  root.setProperty('--term-bg-g', String(g))
  root.setProperty('--term-bg-b', String(b))
  root.setProperty('--term-alpha', String(s.transparency))
}

async function init(): Promise<void> {
  const root = document.getElementById('terminal-root')
  if (!root) throw new Error('terminal-root missing')

  // Apply settings BEFORE mounting xterm to prevent flicker
  try {
    const initial = await window.youtermAPI.settingsGetInitial()
    applySettingsToCSS(initial)
  } catch (err) {
    console.error('[renderer] failed to load initial settings:', err)
  }

  const inner = document.createElement('div')
  inner.id = 'terminal-inner'
  root.appendChild(inner)

  const { term, fit } = mountTerminal(inner)
  const indicator = createModeIndicator(root)

  window.youtermAPI.onPtyData(data => term.write(data))
  term.onData(data => window.youtermAPI.ptyWrite(data))
  window.youtermAPI.onStateChanged(state => indicator.update(state))
  window.youtermAPI.onSettingsChanged(s => applySettingsToCSS(s))

  const doFit = () => {
    try {
      fit.fit()
      window.youtermAPI.ptyResize({ cols: term.cols, rows: term.rows })
    } catch {
      // fit() can throw during 0x0 layout transitions
    }
  }

  requestAnimationFrame(doFit)
  const observer = new ResizeObserver(doFit)
  observer.observe(inner)
}

init()
