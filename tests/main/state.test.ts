import { describe, it, expect } from 'vitest'
import { transition, INITIAL_STATE } from '../../src/main/state'
import type { AppState } from '../../src/shared/types'

describe('state.transition', () => {
  describe('set-mode action', () => {
    it('switches to youtube-only', () => {
      const next = transition(INITIAL_STATE, { type: 'set-mode', mode: 'youtube-only' })
      expect(next).toEqual({ mode: 'youtube-only' })
    })

    it('switches to terminal-only', () => {
      const prev: AppState = { mode: 'overlay' }
      const next = transition(prev, { type: 'set-mode', mode: 'terminal-only' })
      expect(next).toEqual({ mode: 'terminal-only' })
    })

    it('switches to overlay', () => {
      const prev: AppState = { mode: 'youtube-only' }
      const next = transition(prev, { type: 'set-mode', mode: 'overlay' })
      expect(next).toEqual({ mode: 'overlay' })
    })

    it('is idempotent when already in the target mode', () => {
      const state: AppState = { mode: 'overlay' }
      const next = transition(state, { type: 'set-mode', mode: 'overlay' })
      expect(next).toEqual(state)
    })
  })

  it('INITIAL_STATE is overlay', () => {
    expect(INITIAL_STATE).toEqual({ mode: 'overlay' })
  })
})
