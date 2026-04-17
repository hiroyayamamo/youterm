import { mountTerminal } from './terminal'
import { createModeIndicator } from './modeIndicator'

const root = document.getElementById('terminal-root')
if (!root) throw new Error('terminal-root missing')

// Explicitly-sized inner container removes padding-vs-fit ambiguity
const inner = document.createElement('div')
inner.id = 'terminal-inner'
root.appendChild(inner)

const { term, fit } = mountTerminal(inner)
const indicator = createModeIndicator(root)

window.youtermAPI.onPtyData(data => term.write(data))
term.onData(data => window.youtermAPI.ptyWrite(data))
window.youtermAPI.onStateChanged(state => indicator.update(state))

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
