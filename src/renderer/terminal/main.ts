import { mountTerminal } from './terminal'

const root = document.getElementById('terminal-root')
if (!root) throw new Error('terminal-root missing')

const { term, fit } = mountTerminal(root)
term.writeln('youterm v0.1 — waiting for pty...')

window.addEventListener('resize', () => fit.fit())
