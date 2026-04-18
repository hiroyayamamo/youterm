import { describe, it, expect } from 'vitest'
import { transitionTabs, type TabsAction } from '../../src/main/tabs'
import type { TabsState } from '../../src/shared/types'
import { INITIAL_TABS_STATE } from '../../src/shared/types'

describe('transitionTabs', () => {
  describe('new-tab', () => {
    it('appends a new tab with given id', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'new-tab', id: '2' })
      expect(next.tabs).toHaveLength(2)
      expect(next.tabs[1]).toEqual({ id: '2', customName: null })
    })
    it('activates the new tab', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'new-tab', id: '2' })
      expect(next.activeId).toBe('2')
    })
  })

  describe('close-tab', () => {
    it('removes the tab', () => {
      const s: TabsState = {
        tabs: [{ id: '1', customName: null }, { id: '2', customName: null }],
        activeId: '2',
      }
      const next = transitionTabs(s, { type: 'close-tab', id: '2' })
      expect(next.tabs).toEqual([{ id: '1', customName: null }])
    })
    it('activates the previous tab when closing the active one', () => {
      const s: TabsState = {
        tabs: [{ id: '1', customName: null }, { id: '2', customName: null }, { id: '3', customName: null }],
        activeId: '2',
      }
      const next = transitionTabs(s, { type: 'close-tab', id: '2' })
      expect(next.activeId).toBe('1')
    })
    it('activates the next tab when closing the first active tab', () => {
      const s: TabsState = {
        tabs: [{ id: '1', customName: null }, { id: '2', customName: null }],
        activeId: '1',
      }
      const next = transitionTabs(s, { type: 'close-tab', id: '1' })
      expect(next.activeId).toBe('2')
    })
    it('keeps active when closing a non-active tab', () => {
      const s: TabsState = {
        tabs: [{ id: '1', customName: null }, { id: '2', customName: null }],
        activeId: '2',
      }
      const next = transitionTabs(s, { type: 'close-tab', id: '1' })
      expect(next.activeId).toBe('2')
    })
    it('returns same reference when closing only tab', () => {
      const s: TabsState = { tabs: [{ id: '1', customName: null }], activeId: '1' }
      const next = transitionTabs(s, { type: 'close-tab', id: '1' })
      expect(next).toBe(s)
    })
    it('returns same reference when closing a nonexistent tab', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'close-tab', id: 'zzz' })
      expect(next).toBe(INITIAL_TABS_STATE)
    })
  })

  describe('activate-tab', () => {
    it('changes activeId', () => {
      const s: TabsState = {
        tabs: [{ id: '1', customName: null }, { id: '2', customName: null }],
        activeId: '1',
      }
      const next = transitionTabs(s, { type: 'activate-tab', id: '2' })
      expect(next.activeId).toBe('2')
    })
    it('returns same reference when activating already-active tab', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'activate-tab', id: '1' })
      expect(next).toBe(INITIAL_TABS_STATE)
    })
    it('returns same reference for nonexistent tab id', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'activate-tab', id: 'zzz' })
      expect(next).toBe(INITIAL_TABS_STATE)
    })
  })

  describe('rename-tab', () => {
    it('sets customName', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'rename-tab', id: '1', name: 'main' })
      expect(next.tabs[0].customName).toBe('main')
    })
    it('clears customName when name is null', () => {
      const s: TabsState = { tabs: [{ id: '1', customName: 'old' }], activeId: '1' }
      const next = transitionTabs(s, { type: 'rename-tab', id: '1', name: null })
      expect(next.tabs[0].customName).toBeNull()
    })
    it('returns same reference when renaming to the same value', () => {
      const s: TabsState = { tabs: [{ id: '1', customName: 'foo' }], activeId: '1' }
      const next = transitionTabs(s, { type: 'rename-tab', id: '1', name: 'foo' })
      expect(next).toBe(s)
    })
  })
})
