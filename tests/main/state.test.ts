import { describe, it, expect } from 'vitest'
import { transition, INITIAL_STATE } from '../../src/main/state'
import type { AppState } from '../../src/shared/types'

describe('state.transition', () => {
  describe('set-mode action', () => {
    it('switches to youtube-only with inputTarget=youtube', () => {
      const next = transition(INITIAL_STATE, { type: 'set-mode', mode: 'youtube-only' })
      expect(next).toEqual({ mode: 'youtube-only', inputTarget: 'youtube' })
    })

    it('switches to terminal-only with inputTarget=terminal', () => {
      const prev: AppState = { mode: 'overlay', inputTarget: 'youtube' }
      const next = transition(prev, { type: 'set-mode', mode: 'terminal-only' })
      expect(next).toEqual({ mode: 'terminal-only', inputTarget: 'terminal' })
    })

    it('switches to overlay with inputTarget=terminal by default', () => {
      const prev: AppState = { mode: 'youtube-only', inputTarget: 'youtube' }
      const next = transition(prev, { type: 'set-mode', mode: 'overlay' })
      expect(next).toEqual({ mode: 'overlay', inputTarget: 'terminal' })
    })

    it('is idempotent when already in the target mode', () => {
      const state: AppState = { mode: 'overlay', inputTarget: 'youtube' }
      const next = transition(state, { type: 'set-mode', mode: 'overlay' })
      expect(next).toEqual(state)
    })
  })

  describe('toggle-input-target action', () => {
    it('toggles terminal -> youtube in overlay mode', () => {
      const prev: AppState = { mode: 'overlay', inputTarget: 'terminal' }
      const next = transition(prev, { type: 'toggle-input-target' })
      expect(next).toEqual({ mode: 'overlay', inputTarget: 'youtube' })
    })

    it('toggles youtube -> terminal in overlay mode', () => {
      const prev: AppState = { mode: 'overlay', inputTarget: 'youtube' }
      const next = transition(prev, { type: 'toggle-input-target' })
      expect(next).toEqual({ mode: 'overlay', inputTarget: 'terminal' })
    })

    it('is a no-op in youtube-only mode', () => {
      const prev: AppState = { mode: 'youtube-only', inputTarget: 'youtube' }
      const next = transition(prev, { type: 'toggle-input-target' })
      expect(next).toEqual(prev)
    })

    it('is a no-op in terminal-only mode', () => {
      const prev: AppState = { mode: 'terminal-only', inputTarget: 'terminal' }
      const next = transition(prev, { type: 'toggle-input-target' })
      expect(next).toEqual(prev)
    })
  })

  it('INITIAL_STATE is overlay/terminal', () => {
    expect(INITIAL_STATE).toEqual({ mode: 'overlay', inputTarget: 'terminal' })
  })
})
