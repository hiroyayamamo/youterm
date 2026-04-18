import { describe, it, expect } from 'vitest'
import { validateTabsState } from '../../src/main/tabsStore'
import { INITIAL_TABS_STATE } from '../../src/shared/types'

describe('validateTabsState', () => {
  it('passes through a valid TabsState', () => {
    const valid = {
      tabs: [{ id: '1', customName: null, cwd: null }, { id: '2', customName: 'main', cwd: null }],
      activeId: '2',
    }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('falls back to INITIAL_TABS_STATE when input is null', () => {
    expect(validateTabsState(null)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when input is not an object', () => {
    expect(validateTabsState('nope')).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when tabs is not an array', () => {
    const invalid = { tabs: 'nope', activeId: '1' }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when tabs is empty array', () => {
    const invalid = { tabs: [], activeId: '1' }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when a tab is missing id', () => {
    const invalid = { tabs: [{ customName: null }], activeId: 'x' }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('falls back when a tab has invalid customName type', () => {
    const invalid = { tabs: [{ id: '1', customName: 42 }], activeId: '1' }
    expect(validateTabsState(invalid)).toEqual(INITIAL_TABS_STATE)
  })

  it('clamps activeId to first tab id if reference is invalid', () => {
    const raw = { tabs: [{ id: '5', customName: null, cwd: null }, { id: '7', customName: null, cwd: null }], activeId: 'zzz' }
    expect(validateTabsState(raw)).toEqual({
      tabs: [{ id: '5', customName: null, cwd: null }, { id: '7', customName: null, cwd: null }],
      activeId: '5',
    })
  })

  it('accepts tabs with null customName and string customName', () => {
    const valid = {
      tabs: [{ id: '1', customName: null, cwd: null }, { id: '2', customName: 'foo', cwd: null }],
      activeId: '1',
    }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('accepts single-tab state', () => {
    const valid = { tabs: [{ id: '99', customName: 'solo', cwd: null }], activeId: '99' }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('accepts tab with cwd string', () => {
    const valid = { tabs: [{ id: '1', customName: null, cwd: '/Users/foo' }], activeId: '1' }
    expect(validateTabsState(valid)).toEqual(valid)
  })

  it('defaults tab cwd to null when missing (v0.9 → v0.10 backward compat)', () => {
    const raw = { tabs: [{ id: '1', customName: 'main' }], activeId: '1' }
    expect(validateTabsState(raw)).toEqual({
      tabs: [{ id: '1', customName: 'main', cwd: null }],
      activeId: '1',
    })
  })
})
