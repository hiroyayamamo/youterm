import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSettingsController } from '../../src/main/settingsController'
import type { SettingsStore } from '../../src/main/settingsStore'
import type { Settings } from '../../src/shared/types'
import { INITIAL_SETTINGS } from '../../src/shared/types'

const makeFakeStore = (initial: Settings = INITIAL_SETTINGS) => {
  const saves: Settings[] = []
  return {
    store: {
      load: () => initial,
      save: (s: Settings) => { saves.push(s) },
    } as SettingsStore,
    saves,
  }
}

describe('createSettingsController', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('initial state is loaded from store', () => {
    const initial: Settings = { transparency: 0.5, bgColor: 'dark-blue', lastMode: 'terminal-only', blur: 0.3 }
    const { store } = makeFakeStore(initial)
    const ctrl = createSettingsController({ store })
    expect(ctrl.getSettings()).toEqual(initial)
  })

  it('dispatch updates state and notifies subscribers', () => {
    const { store } = makeFakeStore()
    const ctrl = createSettingsController({ store })
    const received: Settings[] = []
    ctrl.subscribe(s => received.push(s))

    ctrl.dispatch({ type: 'set-transparency', value: 0.2 })

    expect(ctrl.getSettings().transparency).toBe(0.2)
    expect(received).toHaveLength(1)
    expect(received[0].transparency).toBe(0.2)
  })

  it('does not notify subscribers when state is unchanged (reference equality)', () => {
    const { store } = makeFakeStore()
    const ctrl = createSettingsController({ store })
    const cb = vi.fn()
    ctrl.subscribe(cb)

    // Same value as INITIAL_SETTINGS.transparency
    ctrl.dispatch({ type: 'set-transparency', value: 0.75 })

    expect(cb).not.toHaveBeenCalled()
  })

  it('debounces store.save', () => {
    const { store, saves } = makeFakeStore()
    const ctrl = createSettingsController({ store, debounceMs: 200 })

    ctrl.dispatch({ type: 'set-transparency', value: 0.1 })
    ctrl.dispatch({ type: 'set-transparency', value: 0.2 })
    ctrl.dispatch({ type: 'set-transparency', value: 0.3 })

    expect(saves).toHaveLength(0) // not yet

    vi.advanceTimersByTime(199)
    expect(saves).toHaveLength(0) // still within debounce

    vi.advanceTimersByTime(1)
    expect(saves).toHaveLength(1)
    expect(saves[0].transparency).toBe(0.3) // only the last value persisted
  })

  it('unsubscribe returns a function that removes the subscriber', () => {
    const { store } = makeFakeStore()
    const ctrl = createSettingsController({ store })
    const cb = vi.fn()
    const unsub = ctrl.subscribe(cb)

    unsub()
    ctrl.dispatch({ type: 'set-transparency', value: 0.5 })

    expect(cb).not.toHaveBeenCalled()
  })
})
