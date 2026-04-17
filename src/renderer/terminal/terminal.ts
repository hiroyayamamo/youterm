import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export interface TerminalBundle {
  term: Terminal
  fit: FitAddon
}

export function mountTerminal(container: HTMLElement): TerminalBundle {
  const term = new Terminal({
    allowTransparency: true,
    theme: {
      background: 'rgba(0,0,0,0)',
      foreground: 'rgb(40, 254, 20)',
      brightWhite: 'rgb(0, 221, 255)',
      cursor: 'rgb(40, 254, 20)',
    },
    fontFamily: 'Menlo, monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 10000,
    drawBoldTextInBrightColors: true,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon())
  term.open(container)
  fit.fit()
  return { term, fit }
}
