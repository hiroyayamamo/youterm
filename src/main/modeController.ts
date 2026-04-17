import type { BrowserWindow, WebContentsView } from 'electron'
import type { AppState, Mode } from '../shared/types'
import { INITIAL_STATE } from '../shared/types'
import { transition, type Action } from './state'

export interface ModeController {
  getState(): AppState
  dispatch(action: Action): void
  subscribe(cb: (state: AppState) => void): () => void
}

export interface ModeControllerDeps {
  win: BrowserWindow
  youtubeView: WebContentsView
  terminalView: WebContentsView
}

export interface CreateModeControllerOptions {
  initialMode?: Mode
}

export function createModeController(
  deps: ModeControllerDeps,
  opts: CreateModeControllerOptions = {},
): ModeController {
  let state: AppState = opts.initialMode
    ? { mode: opts.initialMode, inputTarget: opts.initialMode === 'youtube-only' ? 'youtube' : 'terminal' }
    : INITIAL_STATE
  const subs = new Set<(s: AppState) => void>()

  const applyToViews = () => {
    const { width, height } = deps.win.getContentBounds()
    const hidden = { x: 0, y: 0, width: 0, height: 0 }
    const full = { x: 0, y: 0, width, height }

    switch (state.mode) {
      case 'youtube-only':
        deps.youtubeView.setBounds(full)
        deps.terminalView.setBounds(hidden)
        deps.youtubeView.webContents.focus()
        break
      case 'overlay':
        deps.youtubeView.setBounds(full)
        deps.terminalView.setBounds(full)
        if (state.inputTarget === 'youtube') deps.youtubeView.webContents.focus()
        else deps.terminalView.webContents.focus()
        break
      case 'terminal-only':
        deps.youtubeView.setBounds(hidden)
        deps.terminalView.setBounds(full)
        deps.terminalView.webContents.focus()
        break
    }
  }

  const broadcast = () => {
    for (const cb of subs) cb(state)
    if (!deps.terminalView.webContents.isDestroyed()) {
      deps.terminalView.webContents.send('state:changed', state)
    }
  }

  applyToViews()
  broadcast()

  deps.win.on('resize', applyToViews)

  return {
    getState: () => state,
    dispatch(action) {
      const next = transition(state, action)
      if (next === state) return
      state = next
      applyToViews()
      broadcast()
    },
    subscribe(cb) {
      subs.add(cb)
      cb(state)
      return () => subs.delete(cb)
    },
  }
}
