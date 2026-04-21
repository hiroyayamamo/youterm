import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { createOptionsPanel } from './optionsPanel'
import { createPanelController } from './panelController'
import { createTabBar } from './tabBar'
import type { TabBarHandle } from './tabBar'
import type { Settings, TabsState } from '../../shared/types'
import { COLOR_VALUES } from '../../shared/types'

interface TabRuntime {
  term: Terminal
  fit: FitAddon
  container: HTMLDivElement
}

interface PaneDOM {
  container: HTMLDivElement
  tabBarEl: HTMLDivElement
  termArea: HTMLDivElement
  tabBar: TabBarHandle
}

function applySettingsToCSS(s: Settings): void {
  const { r, g, b } = COLOR_VALUES[s.bgColor]
  const root = document.documentElement.style
  root.setProperty('--term-bg-r', String(r))
  root.setProperty('--term-bg-g', String(g))
  root.setProperty('--term-bg-b', String(b))
  root.setProperty('--term-alpha', String(s.transparency))
  root.setProperty('--term-blur', `${Math.round(s.blur * 20)}px`)
}

function createXtermInstance(): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    allowTransparency: true,
    theme: {
      background: 'rgba(0,0,0,0)',
      foreground: 'rgb(40, 254, 20)',
      cursor: 'rgb(40, 254, 20)',
      cursorAccent: 'rgb(0, 0, 0)',
      selectionBackground: 'rgba(40, 254, 20, 0.3)',
      // Cyberpunk Neon — 16 ANSI colors
      black: 'rgb(0, 0, 0)',
      red: 'rgb(255, 51, 102)',
      green: 'rgb(40, 254, 20)',
      yellow: 'rgb(255, 215, 0)',
      blue: 'rgb(0, 162, 255)',
      magenta: 'rgb(255, 0, 255)',
      cyan: 'rgb(0, 221, 255)',
      white: 'rgb(224, 224, 224)',
      brightBlack: 'rgb(140, 140, 160)',
      brightRed: 'rgb(255, 100, 150)',
      brightGreen: 'rgb(120, 255, 100)',
      brightYellow: 'rgb(255, 240, 80)',
      brightBlue: 'rgb(80, 190, 255)',
      brightMagenta: 'rgb(255, 120, 255)',
      brightCyan: 'rgb(100, 255, 255)',
      brightWhite: 'rgb(0, 221, 255)',
    },
    fontFamily: '"Hack Nerd Font Mono", Menlo, monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 10000,
    drawBoldTextInBrightColors: true,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon())
  return { term, fit }
}

let lastSplitterRatio = 0.5
let splitterPending = false

async function init(): Promise<void> {
  const root = document.getElementById('terminal-root')
  if (!root) throw new Error('terminal-root missing')

  let initialSettings: Settings | undefined
  try {
    initialSettings = await window.youtermAPI.settingsGetInitial()
    applySettingsToCSS(initialSettings)
  } catch (err) {
    console.error('[renderer] failed to load initial settings:', err)
  }

  if (initialSettings) {
    document.body.classList.toggle('video-fill', initialSettings.videoFillMode)
  }

  // Restore saved YouTube URL on launch (fallback to homepage if not set).
  // Root cause of earlier navigation issue was the /next CDP Fetch intercept,
  // removed in v0.12.2; URL restore is safe again.
  {
    const iframe = document.getElementById('youtube-iframe') as HTMLIFrameElement | null
    const targetUrl = initialSettings?.youtubeLastUrl ?? 'https://www.youtube.com/'
    if (iframe && iframe.src !== targetUrl) {
      iframe.src = targetUrl
    }
  }

  // YouTube nav bar (back / forward / reload). Appended to body — not to
  // #terminal-root — because terminal-root is display:none in mode-youtube-only,
  // which is exactly the mode we want the nav bar visible in. Visibility
  // toggling lives in CSS (body.mode-youtube-only #nav-bar).
  const navBar = document.createElement('div')
  navBar.id = 'nav-bar'
  const mkNavBtn = (label: string, title: string, onClick: () => void) => {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.title = title
    btn.addEventListener('click', onClick)
    return btn
  }
  navBar.appendChild(mkNavBtn('←', 'Back', () => window.youtermAPI.youtubeGoBack()))
  navBar.appendChild(mkNavBtn('→', 'Forward', () => window.youtermAPI.youtubeGoForward()))
  navBar.appendChild(mkNavBtn('↻', 'Reload', () => window.youtermAPI.youtubeReload()))
  document.body.appendChild(navBar)

  const panel = createOptionsPanel({
    onTransparencyInput: v => window.youtermAPI.settingsSetTransparency(v),
    onBlurInput: v => window.youtermAPI.settingsSetBlur(v),
    onColorSelect: c => window.youtermAPI.settingsSetColor(c),
    onReset: () => window.youtermAPI.settingsReset(),
  })
  root.appendChild(panel.element)
  if (initialSettings) panel.updateSettings(initialSettings)

  const runtimes = new Map<string, TabRuntime>()
  let tabsState: TabsState | null = null
  const paneDOMs: PaneDOM[] = []

  const panelCtrl = createPanelController({
    panel,
    returnFocus: () => {
      if (!tabsState) return
      const activePane = tabsState.panes[tabsState.activePaneIndex]
      const active = activePane && runtimes.get(activePane.activeId)
      active?.term.focus()
    },
  })

  // True only when at least one pane's termArea is actually laid out. Using
  // offsetWidth/Height avoids resizing the pty to ~0 cols while the terminal
  // is hidden (e.g. mode-youtube-only), which would permanently re-wrap all
  // already-buffered output to an extreme narrow width.
  const terminalIsVisible = (): boolean =>
    paneDOMs.length > 0 &&
    paneDOMs.some(pd => pd.termArea.offsetWidth > 0 && pd.termArea.offsetHeight > 0)

  const refitActive = () => {
    if (!tabsState) return
    const activePane = tabsState.panes[tabsState.activePaneIndex]
    const active = runtimes.get(activePane.activeId)
    if (!active || !terminalIsVisible()) return
    try {
      active.fit.fit()
      window.youtermAPI.ptyResize(activePane.activeId, { cols: active.term.cols, rows: active.term.rows })
    } catch {}
  }

  const applyActiveVisibility = () => {
    if (!tabsState) return
    for (let i = 0; i < tabsState.panes.length; i++) {
      const pane = tabsState.panes[i]
      for (const tab of pane.tabs) {
        const rt = runtimes.get(tab.id)
        if (!rt) continue
        rt.container.classList.toggle('is-active', tab.id === pane.activeId)
      }
    }
    // Focus the focused pane's active terminal
    const activePane = tabsState.panes[tabsState.activePaneIndex]
    const active = runtimes.get(activePane.activeId)
    if (active) {
      active.term.focus()
      refitActive()
    }
  }

  const ensureRuntime = (tabId: string, paneIndex: 0 | 1): TabRuntime => {
    const existing = runtimes.get(tabId)
    const targetTermArea = paneDOMs[paneIndex].termArea
    if (existing) {
      if (existing.container.parentElement !== targetTermArea) {
        targetTermArea.appendChild(existing.container)
        requestAnimationFrame(() => {
          try {
            existing.fit.fit()
            window.youtermAPI.ptyResize(tabId, { cols: existing.term.cols, rows: existing.term.rows })
          } catch {}
        })
      }
      return existing
    }
    const container = document.createElement('div')
    container.className = 'tab-term'
    container.dataset.tabId = tabId
    targetTermArea.appendChild(container)
    const { term, fit } = createXtermInstance()
    term.open(container)
    const runtime: TabRuntime = { term, fit, container }
    runtimes.set(tabId, runtime)

    term.onData(data => window.youtermAPI.ptyWrite(tabId, data))

    requestAnimationFrame(() => {
      // If this runtime's container isn't laid out yet (non-active tab, or
      // mode-youtube-only in effect), skip fit to avoid shrinking the pty
      // to zero cols. The ResizeObserver / mode change handlers will re-fit
      // the moment it becomes visible.
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return
      try {
        fit.fit()
        window.youtermAPI.ptyResize(tabId, { cols: term.cols, rows: term.rows })
      } catch {}
    })

    // Signal main that this tab's xterm is ready to receive pty:data so it
    // can flush the buffered splash (and any early shell output) in order.
    window.youtermAPI.terminalRuntimeReady(tabId)

    return runtime
  }

  const disposeRuntime = (tabId: string) => {
    const r = runtimes.get(tabId)
    if (!r) return
    r.term.dispose()
    r.container.remove()
    runtimes.delete(tabId)
  }

  function installSplitterDrag(el: HTMLDivElement) {
    el.addEventListener('mousedown', down => {
      down.preventDefault()
      el.classList.add('is-dragging')
      const root = document.getElementById('terminal-root')
      if (!root) return
      const rootRect = root.getBoundingClientRect()
      const onMove = (e: MouseEvent) => {
        const raw = (e.clientX - rootRect.left) / rootRect.width
        // Enforce 200px min pane width in addition to the 0.1/0.9 clamp
        // the reducer applies. Ratio range = [minLeft, maxLeft].
        const minLeftPct = Math.max(0.1, 200 / rootRect.width)
        const maxLeftPct = Math.min(0.9, 1 - 200 / rootRect.width)
        const ratio = Math.max(minLeftPct, Math.min(maxLeftPct, raw))
        applySplitRatioToLayout(ratio)
        lastSplitterRatio = ratio
        if (!splitterPending) {
          splitterPending = true
          requestAnimationFrame(() => {
            splitterPending = false
            window.youtermAPI.panesSetRatio(lastSplitterRatio)
          })
        }
      }
      const onUp = () => {
        el.classList.remove('is-dragging')
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        window.youtermAPI.panesSetRatio(lastSplitterRatio)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    })
  }

  function buildPaneDOM(paneIndex: 0 | 1): PaneDOM {
    const container = document.createElement('div')
    container.className = 'pane'
    container.dataset.paneIndex = String(paneIndex)

    const tabBarEl = document.createElement('div')
    tabBarEl.className = 'tab-bar'
    container.appendChild(tabBarEl)

    const termArea = document.createElement('div')
    termArea.className = 'terminal-inner'
    container.appendChild(termArea)

    const tabBar = createTabBar(tabBarEl, paneIndex, {
      onNewTab: () => {
        window.youtermAPI.panesActivate(paneIndex)
        window.youtermAPI.tabsNew()
      },
      onActivate: id => window.youtermAPI.tabsActivate(id),
      onClose: id => window.youtermAPI.tabsClose(id),
      onContextMenu: (id, x, y) => window.youtermAPI.tabsContextMenu(id, x, y),
      onRenameCommit: (id, name) => window.youtermAPI.tabsRename(id, name),
      onMove: (id, beforeId) => window.youtermAPI.tabsMove(id, beforeId),
      onMoveAcross: (id, beforeId) => window.youtermAPI.tabsMoveAcross(id, paneIndex, beforeId),
      onPaneActivate: () => window.youtermAPI.panesActivate(paneIndex),
    })

    container.addEventListener('mousedown', () => {
      window.youtermAPI.panesActivate(paneIndex)
    }, true)

    // Pane-wide drop zone. Dropping a tab anywhere in this pane — the tab-
    // bar empty area, the terminal area, the splitter's edge, etc. —
    // appends the moved tab at the end of the pane. The per-tab listeners
    // still handle precise before/after insertion; we defer to them only
    // when the cursor is over an actual .tab element (not just the tab-
    // bar). Capture phase ensures we intercept before any child (xterm
    // internals in particular) can consume the event.
    container.addEventListener('dragover', e => {
      if (!e.dataTransfer?.types.includes('text/plain')) return
      const target = e.target as Element | null
      if (target?.closest('.tab')) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      container.classList.add('is-drop-target-pane')
    }, true)
    container.addEventListener('dragleave', e => {
      if (!container.contains(e.relatedTarget as Node | null)) {
        container.classList.remove('is-drop-target-pane')
      }
    }, true)
    container.addEventListener('drop', e => {
      container.classList.remove('is-drop-target-pane')
      const target = e.target as Element | null
      if (target?.closest('.tab')) return
      const sourceTabId = e.dataTransfer?.getData('text/plain')
      if (!sourceTabId) return
      const sourcePaneStr = e.dataTransfer?.getData('application/x-youterm-pane') ?? ''
      const sourcePaneIdx = sourcePaneStr === '' ? paneIndex : Number(sourcePaneStr) as 0 | 1
      e.preventDefault()
      e.stopPropagation()
      if (sourcePaneIdx === paneIndex) {
        window.youtermAPI.tabsMove(sourceTabId, null)
      } else {
        window.youtermAPI.tabsMoveAcross(sourceTabId, paneIndex, null)
      }
    }, true)

    return { container, tabBarEl, termArea, tabBar }
  }

  function rebuildPaneLayout(paneCount: 1 | 2) {
    // Detach any existing xterm containers before removing panes so we can
    // re-insert them into the new layout below.
    for (const pd of paneDOMs) {
      Array.from(pd.termArea.children).forEach(ch => pd.termArea.removeChild(ch))
      pd.container.remove()
    }
    paneDOMs.length = 0

    // Also remove any splitter element left over from a previous 2-pane layout.
    // root is guaranteed non-null here (checked at the top of init()).
    const rootEl = root!
    const oldSplitter = rootEl.querySelector('#splitter')
    if (oldSplitter) oldSplitter.remove()

    const newPane0 = buildPaneDOM(0)
    rootEl.appendChild(newPane0.container)
    paneDOMs.push(newPane0)
    if (paneCount === 2) {
      const splitter = document.createElement('div')
      splitter.id = 'splitter'
      rootEl.appendChild(splitter)
      installSplitterDrag(splitter)

      const newPane1 = buildPaneDOM(1)
      rootEl.appendChild(newPane1.container)
      paneDOMs.push(newPane1)
    }

    // Observe all termAreas for resize so refitActive stays accurate.
    for (const pd of paneDOMs) {
      observer.observe(pd.termArea)
    }
  }

  function applySplitRatioToLayout(ratio: number) {
    if (paneDOMs.length !== 2) return
    paneDOMs[0].container.style.flexBasis = `${(ratio * 100).toFixed(2)}%`
    paneDOMs[1].container.style.flexBasis = `${((1 - ratio) * 100).toFixed(2)}%`
  }

  // ResizeObserver is created early so rebuildPaneLayout can register new
  // termAreas into it. The observer callback just calls refitActive.
  const observer = new ResizeObserver(() => refitActive())

  window.youtermAPI.onPtyData(({ tabId, data }) => {
    const r = runtimes.get(tabId)
    r?.term.write(data)
  })

  window.youtermAPI.onSettingsChanged(s => {
    applySettingsToCSS(s)
    panel.updateSettings(s)
    document.body.classList.toggle('video-fill', s.videoFillMode)
  })

  window.youtermAPI.onPanelToggle(() => panelCtrl.toggle())

  window.youtermAPI.onYoutubeReload(url => {
    const iframe = document.getElementById('youtube-iframe') as HTMLIFrameElement | null
    if (!iframe) return
    // If main provided a URL (e.g., homepage on ad-block toggle), navigate
    // there; otherwise just reload the current URL.
    const target = url ?? iframe.src
    iframe.src = 'about:blank'
    requestAnimationFrame(() => { iframe.src = target })
  })

  const applyModeClass = (mode: string) => {
    document.body.classList.remove('mode-youtube-only', 'mode-overlay', 'mode-terminal-only')
    document.body.classList.add(`mode-${mode}`)
  }

  // Pull initial mode state explicitly (avoid race with push-based state:changed)
  try {
    const initialState = await window.youtermAPI.stateGetInitial()
    applyModeClass(initialState.mode)
  } catch (err) {
    console.error('[renderer] failed to load initial state:', err)
  }

  window.youtermAPI.onStateChanged(state => {
    applyModeClass(state.mode)
    const iframe = document.getElementById('youtube-iframe') as HTMLIFrameElement | null
    if (state.mode === 'youtube-only') {
      iframe?.focus()
    } else {
      if (tabsState) {
        const activePane = tabsState.panes[tabsState.activePaneIndex]
        const active = runtimes.get(activePane.activeId)
        active?.term.focus()
      }
      // Terminal just became visible again (from youtube-only). Wait one
      // frame so layout settles, then re-fit so cols/rows reflect the real
      // container size rather than whatever extreme value the pty got stuck
      // at while hidden.
      requestAnimationFrame(() => refitActive())
    }
  })

  window.youtermAPI.onTabsState(state => {
    tabsState = state
    const expectedPaneCount = state.panes.length as 1 | 2
    if (paneDOMs.length !== expectedPaneCount) {
      rebuildPaneLayout(expectedPaneCount)
    }

    if (expectedPaneCount === 2) {
      applySplitRatioToLayout(state.splitRatio)
    }

    // Diff runtimes: dispose orphans, ensure each tab has a runtime in the
    // right pane's termArea.
    const allTabIds = new Set(state.panes.flatMap(p => p.tabs.map(t => t.id)))
    for (const id of runtimes.keys()) {
      if (!allTabIds.has(id)) disposeRuntime(id)
    }
    for (let pIdx = 0; pIdx < state.panes.length; pIdx++) {
      for (const tab of state.panes[pIdx].tabs) {
        ensureRuntime(tab.id, pIdx as 0 | 1)
      }
    }

    // Render each pane's tab bar
    for (let i = 0; i < state.panes.length; i++) {
      paneDOMs[i].tabBar.render(state.panes[i])
      paneDOMs[i].tabBar.setActive(i === state.activePaneIndex)
    }

    applyActiveVisibility()
  })

  window.youtermAPI.onStartRename(tabId => {
    // Find which pane contains the tab so the correct tabBar gets the rename.
    if (!tabsState) return
    for (let i = 0; i < tabsState.panes.length; i++) {
      if (tabsState.panes[i].tabs.some(t => t.id === tabId)) {
        paneDOMs[i]?.tabBar.startRename(tabId)
        return
      }
    }
  })

  try {
    const initialTabs = await window.youtermAPI.tabsGetInitial()
    tabsState = initialTabs
    const expectedPaneCount = initialTabs.panes.length as 1 | 2
    rebuildPaneLayout(expectedPaneCount)
    if (expectedPaneCount === 2) {
      applySplitRatioToLayout(initialTabs.splitRatio)
    }
    for (let pIdx = 0; pIdx < initialTabs.panes.length; pIdx++) {
      for (const tab of initialTabs.panes[pIdx].tabs) {
        ensureRuntime(tab.id, pIdx as 0 | 1)
      }
    }
    for (let i = 0; i < initialTabs.panes.length; i++) {
      paneDOMs[i].tabBar.render(initialTabs.panes[i])
      paneDOMs[i].tabBar.setActive(i === initialTabs.activePaneIndex)
    }
    applyActiveVisibility()
  } catch (err) {
    console.error('[renderer] failed to load initial tabs:', err)
  }
}

init()
