import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { createOptionsPanel } from './optionsPanel'
import { createPanelController } from './panelController'
import { createTabBar } from './tabBar'
import type { Settings, TabsState } from '../../shared/types'
import { COLOR_VALUES } from '../../shared/types'

interface TabRuntime {
  term: Terminal
  fit: FitAddon
  container: HTMLDivElement
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
      brightBlack: 'rgb(80, 80, 80)',
      brightRed: 'rgb(255, 100, 150)',
      brightGreen: 'rgb(120, 255, 100)',
      brightYellow: 'rgb(255, 240, 80)',
      brightBlue: 'rgb(80, 190, 255)',
      brightMagenta: 'rgb(255, 120, 255)',
      brightCyan: 'rgb(100, 255, 255)',
      brightWhite: 'rgb(0, 221, 255)',
    },
    fontFamily: 'Menlo, monospace',
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

  // Tab bar
  const tabBarEl = document.createElement('div')
  tabBarEl.id = 'tab-bar'
  root.appendChild(tabBarEl)

  // Terminal area
  const termArea = document.createElement('div')
  termArea.id = 'terminal-inner'
  root.appendChild(termArea)

  const panel = createOptionsPanel({
    onTransparencyInput: v => window.youtermAPI.settingsSetTransparency(v),
    onBlurInput: v => window.youtermAPI.settingsSetBlur(v),
    onColorSelect: c => window.youtermAPI.settingsSetColor(c),
    onAdBlockChange: e => window.youtermAPI.settingsSetAdBlock(e),
    onReset: () => window.youtermAPI.settingsReset(),
  })
  root.appendChild(panel.element)
  if (initialSettings) panel.updateSettings(initialSettings)

  const runtimes = new Map<string, TabRuntime>()
  let tabsState: TabsState | null = null

  const panelCtrl = createPanelController({
    panel,
    returnFocus: () => {
      const active = tabsState && runtimes.get(tabsState.activeId)
      active?.term.focus()
    },
  })

  const ensureRuntime = (tabId: string): TabRuntime => {
    const existing = runtimes.get(tabId)
    if (existing) return existing
    const container = document.createElement('div')
    container.className = 'tab-term'
    container.dataset.tabId = tabId
    termArea.appendChild(container)
    const { term, fit } = createXtermInstance()
    term.open(container)
    const runtime: TabRuntime = { term, fit, container }
    runtimes.set(tabId, runtime)

    term.onData(data => window.youtermAPI.ptyWrite(tabId, data))

    requestAnimationFrame(() => {
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

  const applyActiveVisibility = () => {
    if (!tabsState) return
    for (const [tabId, runtime] of runtimes.entries()) {
      runtime.container.classList.toggle('is-active', tabId === tabsState.activeId)
    }
    const active = runtimes.get(tabsState.activeId)
    if (active) {
      active.term.focus()
      try {
        active.fit.fit()
        window.youtermAPI.ptyResize(tabsState.activeId, { cols: active.term.cols, rows: active.term.rows })
      } catch {}
    }
  }

  const tabBar = createTabBar(tabBarEl, {
    onNewTab: () => window.youtermAPI.tabsNew(),
    onActivate: id => window.youtermAPI.tabsActivate(id),
    onClose: id => window.youtermAPI.tabsClose(id),
    onContextMenu: (id, x, y) => window.youtermAPI.tabsContextMenu(id, x, y),
    onRenameCommit: (id, name) => window.youtermAPI.tabsRename(id, name),
  })

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
      const active = tabsState && runtimes.get(tabsState.activeId)
      active?.term.focus()
    }
  })

  window.youtermAPI.onTabsState(state => {
    tabsState = state
    const existingIds = new Set(runtimes.keys())
    const nextIds = new Set(state.tabs.map(t => t.id))
    for (const id of existingIds) {
      if (!nextIds.has(id)) disposeRuntime(id)
    }
    for (const tab of state.tabs) {
      if (!existingIds.has(tab.id)) ensureRuntime(tab.id)
    }
    tabBar.render(state)
    applyActiveVisibility()
  })

  window.youtermAPI.onStartRename(tabId => {
    tabBar.startRename(tabId)
  })

  try {
    const initialTabs = await window.youtermAPI.tabsGetInitial()
    tabsState = initialTabs
    for (const tab of initialTabs.tabs) ensureRuntime(tab.id)
    tabBar.render(initialTabs)
    applyActiveVisibility()
  } catch (err) {
    console.error('[renderer] failed to load initial tabs:', err)
  }

  const observer = new ResizeObserver(() => {
    if (!tabsState) return
    const r = runtimes.get(tabsState.activeId)
    if (!r) return
    try {
      r.fit.fit()
      window.youtermAPI.ptyResize(tabsState.activeId, { cols: r.term.cols, rows: r.term.rows })
    } catch {}
  })
  observer.observe(termArea)

}

init()
