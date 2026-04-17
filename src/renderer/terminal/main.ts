import { mountTerminal } from './terminal'

const root = document.getElementById('terminal-root')
if (!root) throw new Error('terminal-root missing')

const { term, fit } = mountTerminal(root)

window.youtermAPI.onPtyData(data => term.write(data))
term.onData(data => window.youtermAPI.ptyWrite(data))

const resize = () => {
  fit.fit()
  window.youtermAPI.ptyResize({ cols: term.cols, rows: term.rows })
}
resize()
window.addEventListener('resize', resize)
