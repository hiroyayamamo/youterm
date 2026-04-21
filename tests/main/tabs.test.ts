import { describe, it, expect } from 'vitest'
import { transitionTabs, type TabsAction } from '../../src/main/tabs'
import type { Pane, Tab, TabsState } from '../../src/shared/types'
import { INITIAL_TABS_STATE } from '../../src/shared/types'

function makeState(panes: Pane[], activePaneIndex = 0, splitRatio = 0.5): TabsState {
  return { panes, activePaneIndex, splitRatio }
}
function onePane(tabs: Tab[], activeId?: string): TabsState {
  return makeState([{ tabs, activeId: activeId ?? tabs[0].id }])
}
function twoPanes(left: Pane, right: Pane, activePaneIndex: 0 | 1 = 0): TabsState {
  return makeState([left, right], activePaneIndex)
}

describe('transitionTabs', () => {
  describe('new-tab', () => {
    it('appends a new tab with given id', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'new-tab', id: '2' })
      expect(next.panes[0].tabs).toHaveLength(2)
      expect(next.panes[0].tabs[1]).toEqual({ id: '2', customName: null, cwd: null })
    })
    it('activates the new tab', () => {
      const next = transitionTabs(INITIAL_TABS_STATE, { type: 'new-tab', id: '2' })
      expect(next.panes[0].activeId).toBe('2')
    })
  })

  describe('close-tab', () => {
    it('removes the tab', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }, { id: '2', customName: null, cwd: null }], '2')
      const next = transitionTabs(s, { type: 'close-tab', id: '2' })
      expect(next.panes[0].tabs).toEqual([{ id: '1', customName: null, cwd: null }])
    })
    it('activates the previous tab when closing the active one', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }, { id: '2', customName: null, cwd: null }, { id: '3', customName: null, cwd: null }], '2')
      const next = transitionTabs(s, { type: 'close-tab', id: '2' })
      expect(next.panes[0].activeId).toBe('1')
    })
    it('activates the next tab when closing the first active tab', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }, { id: '2', customName: null, cwd: null }], '1')
      const next = transitionTabs(s, { type: 'close-tab', id: '1' })
      expect(next.panes[0].activeId).toBe('2')
    })
    it('keeps active when closing a non-active tab', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }, { id: '2', customName: null, cwd: null }], '2')
      const next = transitionTabs(s, { type: 'close-tab', id: '1' })
      expect(next.panes[0].activeId).toBe('2')
    })
    it('returns same reference when closing only tab', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }], '1')
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
      const s = onePane([{ id: '1', customName: null, cwd: null }, { id: '2', customName: null, cwd: null }], '1')
      const next = transitionTabs(s, { type: 'activate-tab', id: '2' })
      expect(next.panes[0].activeId).toBe('2')
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
      expect(next.panes[0].tabs[0].customName).toBe('main')
    })
    it('clears customName when name is null', () => {
      const s = onePane([{ id: '1', customName: 'old', cwd: null }], '1')
      const next = transitionTabs(s, { type: 'rename-tab', id: '1', name: null })
      expect(next.panes[0].tabs[0].customName).toBeNull()
    })
    it('returns same reference when renaming to the same value', () => {
      const s = onePane([{ id: '1', customName: 'foo', cwd: null }], '1')
      const next = transitionTabs(s, { type: 'rename-tab', id: '1', name: 'foo' })
      expect(next).toBe(s)
    })
  })

  describe('set-tab-cwds', () => {
    it('sets cwd for matching tabs', () => {
      const s = onePane([
        { id: '1', customName: null, cwd: null },
        { id: '2', customName: null, cwd: null },
      ], '1')
      const next = transitionTabs(s, {
        type: 'set-tab-cwds',
        cwds: { '1': '/Users/foo', '2': '/tmp' },
      })
      expect(next.panes[0].tabs[0].cwd).toBe('/Users/foo')
      expect(next.panes[0].tabs[1].cwd).toBe('/tmp')
    })

    it('skips tabs not in cwds map', () => {
      const s = onePane([
        { id: '1', customName: null, cwd: '/existing' },
        { id: '2', customName: null, cwd: null },
      ], '1')
      const next = transitionTabs(s, {
        type: 'set-tab-cwds',
        cwds: { '2': '/tmp' },
      })
      expect(next.panes[0].tabs[0].cwd).toBe('/existing')
      expect(next.panes[0].tabs[1].cwd).toBe('/tmp')
    })

    it('returns same reference when no changes', () => {
      const s = onePane([{ id: '1', customName: null, cwd: '/foo' }], '1')
      const next = transitionTabs(s, {
        type: 'set-tab-cwds',
        cwds: { '1': '/foo' },
      })
      expect(next).toBe(s)
    })

    it('returns same reference when cwds map is empty', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }], '1')
      const next = transitionTabs(s, { type: 'set-tab-cwds', cwds: {} })
      expect(next).toBe(s)
    })
  })

  describe('split-panes', () => {
    it('splits a single pane and adds the new tab to the right pane', () => {
      const s = onePane([{ id: '1', customName: null, cwd: null }])
      const next = transitionTabs(s, { type: 'split-panes', newTabId: '2' })
      expect(next.panes).toHaveLength(2)
      expect(next.panes[0].tabs.map(t => t.id)).toEqual(['1'])
      expect(next.panes[1].tabs.map(t => t.id)).toEqual(['2'])
      expect(next.panes[1].activeId).toBe('2')
      expect(next.activePaneIndex).toBe(1)
    })

    it('is a no-op when already split', () => {
      const s = twoPanes(
        { tabs: [{ id: '1', customName: null, cwd: null }], activeId: '1' },
        { tabs: [{ id: '2', customName: null, cwd: null }], activeId: '2' },
      )
      const next = transitionTabs(s, { type: 'split-panes', newTabId: '3' })
      expect(next).toBe(s)
    })
  })

  describe('move-tab', () => {
    const threeTabs = (): TabsState => onePane([
      { id: '1', customName: null, cwd: null },
      { id: '2', customName: null, cwd: null },
      { id: '3', customName: null, cwd: null },
    ], '1')

    it('moves a tab before another tab', () => {
      const next = transitionTabs(threeTabs(), { type: 'move-tab', id: '3', beforeId: '1' })
      expect(next.panes[0].tabs.map(t => t.id)).toEqual(['3', '1', '2'])
    })

    it('moves a tab to the end when beforeId is null', () => {
      const next = transitionTabs(threeTabs(), { type: 'move-tab', id: '1', beforeId: null })
      expect(next.panes[0].tabs.map(t => t.id)).toEqual(['2', '3', '1'])
    })

    it('preserves activeId when reordering', () => {
      const next = transitionTabs(threeTabs(), { type: 'move-tab', id: '3', beforeId: '1' })
      expect(next.panes[0].activeId).toBe('1')
    })

    it('is a no-op when dropping a tab before itself', () => {
      const s = threeTabs()
      const next = transitionTabs(s, { type: 'move-tab', id: '2', beforeId: '2' })
      expect(next).toBe(s)
    })

    it('is a no-op when the resulting order is unchanged', () => {
      const s = threeTabs()
      // Moving tab 1 before tab 2 — tab 1 is already before tab 2.
      const next = transitionTabs(s, { type: 'move-tab', id: '1', beforeId: '2' })
      expect(next).toBe(s)
    })

    it('returns the same reference when the dragged id does not exist', () => {
      const s = threeTabs()
      const next = transitionTabs(s, { type: 'move-tab', id: 'does-not-exist', beforeId: '1' })
      expect(next).toBe(s)
    })

    it('returns the same reference when the beforeId does not exist', () => {
      const s = threeTabs()
      const next = transitionTabs(s, { type: 'move-tab', id: '1', beforeId: 'does-not-exist' })
      expect(next).toBe(s)
    })
  })
})
