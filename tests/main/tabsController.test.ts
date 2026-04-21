import { describe, it, expect, vi } from 'vitest'
import { createTabsController } from '../../src/main/tabsController'
import type { PtyHandle } from '../../src/main/pty'
import type { Pane, Tab, TabsState } from '../../src/shared/types'

// ---------------------------------------------------------------------------
// State shape helpers (mirrors tabs.test.ts)
// ---------------------------------------------------------------------------
function makeState(panes: Pane[], activePaneIndex = 0, splitRatio = 0.5): TabsState {
  return { panes, activePaneIndex, splitRatio }
}
function onePane(tabs: Tab[], activeId?: string): TabsState {
  return makeState([{ tabs, activeId: activeId ?? tabs[0].id }])
}

// ---------------------------------------------------------------------------
// Fake pty factory
// ---------------------------------------------------------------------------
const makeFakePtyFactory = () => {
  const created: string[] = []
  const killed: string[] = []
  const handlesById = new Map<string, PtyHandle & {
    _data: ((d: string) => void)[]
    _exit: (() => void)[]
  }>()
  const spawn = (tabId: string): PtyHandle => {
    const dataHandlers: ((d: string) => void)[] = []
    const exitHandlers: (() => void)[] = []
    const handle = {
      onData: (cb: (d: string) => void) => {
        dataHandlers.push(cb)
        return () => {
          const i = dataHandlers.indexOf(cb)
          if (i >= 0) dataHandlers.splice(i, 1)
        }
      },
      onExit: (cb: () => void) => {
        exitHandlers.push(cb)
        return () => {
          const i = exitHandlers.indexOf(cb)
          if (i >= 0) exitHandlers.splice(i, 1)
        }
      },
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(() => {
        killed.push(tabId)
      }),
      getPid: () => parseInt(tabId, 10) + 1000,
      _data: dataHandlers,
      _exit: exitHandlers,
    } as unknown as PtyHandle & {
      _data: ((d: string) => void)[]
      _exit: (() => void)[]
    }
    handlesById.set(tabId, handle)
    created.push(tabId)
    return handle
  }
  return { spawn, created, killed, handlesById }
}

describe('createTabsController', () => {
  it('initial state has one tab with a pty spawned', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    expect(ctrl.getState().panes[0].tabs).toHaveLength(1)
    expect(factory.created).toEqual(['1'])
  })

  it('newTab spawns a new pty and activates the new tab', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.newTab()
    expect(factory.created).toEqual(['1', '2'])
    expect(ctrl.getState().panes[0].activeId).toBe('2')
  })

  it('closeTab kills pty and removes tab when no children', async () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.newTab()
    const result = await ctrl.closeTab('2')
    expect(result).toBe('closed')
    expect(factory.killed).toEqual(['2'])
    expect(ctrl.getState().panes[0].tabs).toHaveLength(1)
  })

  it('closeTab prompts dialog and cancels close on deny', async () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => true,
      onDialogConfirm: async () => false,
      onData: () => {},
    })
    ctrl.newTab()
    const result = await ctrl.closeTab('2')
    expect(result).toBe('cancelled')
    expect(factory.killed).toEqual([])
    expect(ctrl.getState().panes[0].tabs).toHaveLength(2)
  })

  it('closeTab prompts dialog and proceeds on confirm', async () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => true,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.newTab()
    const result = await ctrl.closeTab('2')
    expect(result).toBe('closed')
    expect(factory.killed).toEqual(['2'])
  })

  it('forwards pty onData to the callback with tabId', () => {
    const factory = makeFakePtyFactory()
    const received: Array<{ tabId: string; data: string }> = []
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: (tabId, data) => received.push({ tabId, data }),
    })
    factory.handlesById.get('1')!._data.forEach(h => h('hello\n'))
    expect(received).toEqual([{ tabId: '1', data: 'hello\n' }])
    ctrl.newTab()
    factory.handlesById.get('2')!._data.forEach(h => h('world\n'))
    expect(received).toContainEqual({ tabId: '2', data: 'world\n' })
  })

  it('write and resize are routed by tabId', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.newTab()
    ctrl.write('2', 'cmd\n')
    ctrl.resize('1', 100, 40)
    expect(factory.handlesById.get('2')!.write).toHaveBeenCalledWith('cmd\n')
    expect(factory.handlesById.get('1')!.resize).toHaveBeenCalledWith(100, 40)
  })

  it('closeTab on last tab returns close-window signal without killing pty', async () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    const result = await ctrl.closeTab('1')
    expect(result).toBe('close-window')
    expect(factory.killed).toEqual([])
  })

  it('renameTab updates state', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.renameTab('1', 'main')
    expect(ctrl.getState().panes[0].tabs[0].customName).toBe('main')
  })

  it('activateTab updates activeId', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.newTab()
    ctrl.activateTab('1')
    expect(ctrl.getState().panes[0].activeId).toBe('1')
  })

  it('subscribers are notified on state changes', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    const received: number[] = []
    ctrl.subscribe(s => received.push(s.panes[0].tabs.length))
    ctrl.newTab()
    ctrl.newTab()
    expect(received).toEqual([2, 3])
  })

  it('loads initial state from store when provided', () => {
    const factory = makeFakePtyFactory()
    const store = {
      load: () => onePane(
        [
          { id: '5', customName: 'main', cwd: null },
          { id: '7', customName: null, cwd: null },
        ],
        '7',
      ),
      save: vi.fn(),
    }
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      store,
    })
    expect(ctrl.getState().panes[0].tabs).toHaveLength(2)
    expect(ctrl.getState().panes[0].activeId).toBe('7')
    expect(factory.created).toEqual(['5', '7']) // one pty per restored tab
  })

  it('next new tab ID continues past the max restored ID', () => {
    const factory = makeFakePtyFactory()
    const store = {
      load: () => onePane(
        [{ id: '5', customName: null, cwd: null }, { id: '9', customName: null, cwd: null }],
        '5',
      ),
      save: vi.fn(),
    }
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      store,
    })
    ctrl.newTab()
    // New tab ID should be '10' (= max restored 9 + 1)
    expect(ctrl.getState().panes[0].tabs.map(t => t.id)).toContain('10')
  })

  it('captureCwds uses getCwdForPid to update tab cwds', async () => {
    const factory = makeFakePtyFactory()
    const getCwdForPid = vi.fn(async (pid: number) => '/mocked/' + pid)
    const store = {
      load: () => onePane([{ id: '1', customName: null, cwd: null }], '1'),
      save: vi.fn(),
    }
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      getCwdForPid,
      store,
    })
    await ctrl.captureCwds()
    // pid used by factory is parseInt(tabId) + 1000 → tab 1 → pid 1001 → cwd /mocked/1001
    expect(ctrl.getState().panes[0].tabs[0].cwd).toBe('/mocked/1001')
    expect(getCwdForPid).toHaveBeenCalledWith(1001)
  })

  it('captureCwds is a no-op when getCwdForPid is not provided', async () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    await ctrl.captureCwds()
    expect(ctrl.getState().panes[0].tabs[0].cwd).toBe(null)
  })

  it('captureCwds skips tabs where getCwdForPid returns null', async () => {
    const factory = makeFakePtyFactory()
    const getCwdForPid = vi.fn(async () => null)
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      getCwdForPid,
    })
    await ctrl.captureCwds()
    expect(ctrl.getState().panes[0].tabs[0].cwd).toBe(null)
  })

  it('debounces store.save on state changes', () => {
    vi.useFakeTimers()
    const factory = makeFakePtyFactory()
    const saveMock = vi.fn()
    const store = {
      load: () => onePane([{ id: '1', customName: null, cwd: null }], '1'),
      save: saveMock,
    }
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      store,
      debounceMs: 200,
    })
    ctrl.newTab()
    ctrl.renameTab('2', 'test')
    expect(saveMock).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(199)
    expect(saveMock).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(1)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock.mock.calls[0][0].panes[0].tabs).toHaveLength(2)
    vi.useRealTimers()
  })

  it('flushSave cancels pending timer and writes immediately', () => {
    vi.useFakeTimers()
    const factory = makeFakePtyFactory()
    const saveMock = vi.fn()
    const store = {
      load: () => onePane([{ id: '1', customName: null, cwd: null }], '1'),
      save: saveMock,
    }
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      store,
      debounceMs: 200,
    })
    ctrl.newTab()
    // debounce timer set, but not fired yet
    expect(saveMock).toHaveBeenCalledTimes(0)
    ctrl.flushSave()
    // flushed immediately
    expect(saveMock).toHaveBeenCalledTimes(1)
    // No additional save when timer would have fired
    vi.advanceTimersByTime(500)
    expect(saveMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('onSpawn is called for each pty spawn (initial + newTab)', () => {
    const factory = makeFakePtyFactory()
    const onSpawn = vi.fn()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      onSpawn,
    })
    // Initial tab
    expect(onSpawn).toHaveBeenCalledWith('1')
    ctrl.newTab()
    expect(onSpawn).toHaveBeenCalledWith('2')
    expect(onSpawn).toHaveBeenCalledTimes(2)
  })

  it('captureCwds flushes save synchronously', async () => {
    vi.useFakeTimers()
    const factory = makeFakePtyFactory()
    const saveMock = vi.fn()
    const getCwdForPid = vi.fn(async () => '/home/test')
    const store = {
      load: () => onePane([{ id: '1', customName: null, cwd: null }], '1'),
      save: saveMock,
    }
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
      getCwdForPid,
      store,
      debounceMs: 200,
    })
    await ctrl.captureCwds()
    // Must have saved without advancing timer
    expect(saveMock).toHaveBeenCalledTimes(1)
    const savedState = saveMock.mock.calls[0][0]
    expect(savedState.panes[0].tabs[0].cwd).toBe('/home/test')
    vi.useRealTimers()
  })
})

describe('toggleSplit', () => {
  it('splits from one pane to two and spawns a pty for the new tab', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    // Initially 1 pane, 1 tab, 1 pty spawned
    expect(factory.created).toHaveLength(1)
    ctrl.toggleSplit()
    const s = ctrl.getState()
    expect(s.panes).toHaveLength(2)
    expect(s.activePaneIndex).toBe(1)
    // A second pty should have been spawned for the new tab in pane 1
    expect(factory.created).toHaveLength(2)
  })

  it('unsplits from two panes to one without killing ptys', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    ctrl.toggleSplit() // enter split state
    const killCountBefore = factory.killed.length
    ctrl.toggleSplit() // unsplit
    const s = ctrl.getState()
    expect(s.panes).toHaveLength(1)
    // No additional pty kills should have happened
    expect(factory.killed.length).toBe(killCountBefore)
  })
})

describe('moveTabToPane', () => {
  it('moves a tab between panes without respawning pty', () => {
    const factory = makeFakePtyFactory()
    const ctrl = createTabsController({
      spawnPty: (tabId, _cwd) => factory.spawn(tabId),
      hasChildren: async () => false,
      onDialogConfirm: async () => true,
      onData: () => {},
    })
    // Set up split state: pane 0 = [tab '1'], pane 1 = [tab '2'] (active)
    ctrl.toggleSplit()
    // Add a second tab to pane 1 (currently active) so pane 1 has 2 tabs
    // and moving one of them to pane 0 leaves pane 1 non-empty.
    ctrl.newTab() // tab '3' → pane 1 = [tab '2', tab '3']
    const spawnCountBefore = factory.created.length
    // Move tab '2' from pane 1 to pane 0
    ctrl.moveTabToPane('2', 0, null)
    // No new pty should have been spawned
    expect(factory.created.length).toBe(spawnCountBefore)
    // Tab '2' should now be in pane 0
    const s = ctrl.getState()
    expect(s.panes).toHaveLength(2)
    const pane0TabIds = s.panes[0].tabs.map(t => t.id)
    expect(pane0TabIds).toContain('2')
  })
})
