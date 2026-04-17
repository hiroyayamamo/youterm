import { mountTerminal } from './terminal'

const root = document.getElementById('terminal-root')
if (!root) throw new Error('terminal-root missing')

const { term, fit } = mountTerminal(root)

window.youtermAPI.onPtyData(data => term.write(data))
term.onData(data => window.youtermAPI.ptyWrite(data))

const doFit = () => {
  try {
    fit.fit()
    window.youtermAPI.ptyResize({ cols: term.cols, rows: term.rows })
  } catch {
    // fit() can throw if container has zero dimensions during early layout
  }
}

// Run after first paint for safe initial sizing
requestAnimationFrame(doFit)

// React to any container size change (includes window resize + layout shifts)
const observer = new ResizeObserver(doFit)
observer.observe(root)
