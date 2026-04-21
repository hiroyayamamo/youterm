import { describe, it, expect } from 'vitest'
import { validateTabsState } from '../../src/main/tabsStore'
import { INITIAL_TABS_STATE } from '../../src/shared/types'

describe('validateTabsState', () => {
  it('passes through a valid TabsState', () => {
    const valid = {
      panes: [{ tabs: [{ id: '1', customName: null, cwd: null }, { id: '2', customName: 'main', cwd: null }], activeId: '2' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('falls back to INITIAL_TABS_STATE when input is null', () => {
    expect(validateTabsState(null)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when input is not an object', () => {
    expect(validateTabsState('nope')).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when panes is not an array', () => {
    const invalid = { panes: 'nope', activePaneIndex: 0, splitRatio: 0.5 }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when panes is empty array', () => {
    const invalid = { panes: [], activePaneIndex: 0, splitRatio: 0.5 }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when a tab is missing id', () => {
    const invalid = {
      panes: [{ tabs: [{ customName: null }], activeId: 'x' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when a tab has invalid customName type', () => {
    const invalid = {
      panes: [{ tabs: [{ id: '1', customName: 42 }], activeId: '1' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when pane activeId does not match any tab', () => {
    const invalid = {
      panes: [{ tabs: [{ id: '5', customName: null, cwd: null }, { id: '7', customName: null, cwd: null }], activeId: 'zzz' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('accepts tabs with null customName and string customName', () => {
    const valid = {
      panes: [{ tabs: [{ id: '1', customName: null, cwd: null }, { id: '2', customName: 'foo', cwd: null }], activeId: '1' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('accepts single-tab state', () => {
    const valid = {
      panes: [{ tabs: [{ id: '99', customName: 'solo', cwd: null }], activeId: '99' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('accepts tab with cwd string', () => {
    const valid = {
      panes: [{ tabs: [{ id: '1', customName: null, cwd: '/Users/foo' }], activeId: '1' }],
      activePaneIndex: 0,
      splitRatio: 0.5,
    }
    expect(validateTabsState(valid)).toEqual(valid)
  })
})

describe('tabsStore migration', () => {
  it('migrates old shape to new shape', () => {
    const oldShape = {
      tabs: [{ id: '1', customName: null, cwd: null }],
      activeId: '1',
    }
    const loaded = validateTabsState(oldShape)
    expect(loaded.panes).toHaveLength(1)
    expect(loaded.panes[0].tabs).toEqual(oldShape.tabs)
    expect(loaded.activePaneIndex).toBe(0)
    expect(loaded.splitRatio).toBe(0.5)
  })

  it('accepts a valid new-shape JSON as-is', () => {
    const newShape = {
      panes: [
        { tabs: [{ id: '1', customName: null, cwd: null }], activeId: '1' },
        { tabs: [{ id: '2', customName: 'work', cwd: '/home' }], activeId: '2' },
      ],
      activePaneIndex: 1,
      splitRatio: 0.6,
    }
    const loaded = validateTabsState(newShape)
    expect(loaded).toEqual(newShape)
  })

  it('falls back to INITIAL_TABS_STATE on malformed JSON (non-object)', () => {
    const loaded = validateTabsState('not valid json')
    expect(loaded).toEqual(INITIAL_TABS_STATE)
  })

  it('clamps out-of-range splitRatio to 0.5', () => {
    const shape = {
      panes: [{ tabs: [{ id: '1', customName: null, cwd: null }], activeId: '1' }],
      activePaneIndex: 0,
      splitRatio: 5,
    }
    const loaded = validateTabsState(shape)
    expect(loaded.splitRatio).toBe(0.5)
  })
})
