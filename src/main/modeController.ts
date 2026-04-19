import type { BrowserWindow } from 'electron'
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
}

export interface CreateModeControllerOptions {
  initialMode?: Mode
}

export function createModeController(
  deps: ModeControllerDeps,
  opts: CreateModeControllerOptions = {},
): ModeController {
  let state: AppState = opts.initialMode
    ? { mode: opts.initialMode }
    : INITIAL_STATE
  const subs = new Set<(s: AppState) => void>()

  const broadcast = () => {
    for (const cb of subs) cb(state)
    if (!deps.win.webContents.isDestroyed()) {
      deps.win.webContents.send('state:changed', state)
    }
  }

  // Initial broadcast (subscribers can install after return, but we also need the
  // renderer to receive the initial state once it's ready). We'll rely on the
  // renderer's settingsGetInitial + onStateChanged pattern, AND the first broadcast
  // fires on next tick so the IPC channel is ready.
  setTimeout(broadcast, 0)

  return {
    getState: () => state,
    dispatch(action) {
      const next = transition(state, action)
      if (next === state) return
      state = next
      broadcast()
    },
    subscribe(cb) {
      subs.add(cb)
      cb(state)
      return () => subs.delete(cb)
    },
  }
}
