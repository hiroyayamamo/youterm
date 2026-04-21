import type { Tab } from '../../shared/types'

export interface TabBarCallbacks {
  onNewTab(): void
  onActivate(tabId: string): void
  onClose(tabId: string): void
  onContextMenu(tabId: string, x: number, y: number): void
  onRenameCommit(tabId: string, name: string | null): void
  onMove(tabId: string, beforeTabId: string | null): void
  onMoveAcross(tabId: string, beforeTabId: string | null): void
  onPaneActivate(): void
}

export interface TabBarHandle {
  render(pane: { tabs: Tab[]; activeId: string }): void
  startRename(tabId: string): void
  setActive(active: boolean): void
}

export function createTabBar(
  container: HTMLElement,
  paneIndex: 0 | 1,
  cb: TabBarCallbacks,
): TabBarHandle {
  const list = document.createElement('div')
  list.className = 'tab-list'
  container.appendChild(list)

  const newBtn = document.createElement('button')
  newBtn.className = 'tab-new'
  newBtn.textContent = '+'
  newBtn.setAttribute('aria-label', 'New tab')
  newBtn.addEventListener('click', e => { e.stopPropagation(); cb.onNewTab() })
  container.appendChild(newBtn)

  // Mousedown on the container activates this pane (capture phase so it fires
  // before any child handlers).
  container.addEventListener('mousedown', () => cb.onPaneActivate(), true)

  let currentPane: { tabs: Tab[]; activeId: string } | null = null
  let renamingTabId: string | null = null
  let draggingTabId: string | null = null

  // Remove drop-zone highlights from every tab. Kept as a helper so drop /
  // dragend / dragleave all end up calling the same cleanup.
  const clearDropMarkers = () => {
    for (const el of list.querySelectorAll('.tab')) {
      el.classList.remove('drop-before', 'drop-after')
    }
  }

  const finishRename = (tabId: string, value: string | null) => {
    renamingTabId = null
    cb.onRenameCommit(tabId, value && value.trim() !== '' ? value : null)
  }

  const render = (pane: { tabs: Tab[]; activeId: string }) => {
    currentPane = pane
    list.innerHTML = ''
    for (const tab of pane.tabs) {
      const tabEl = document.createElement('div')
      tabEl.className = 'tab'
      tabEl.dataset.tabId = tab.id
      if (tab.id === pane.activeId) tabEl.classList.add('is-active')

      if (renamingTabId === tab.id) {
        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'tab-rename-input'
        input.value = tab.customName ?? ''
        input.placeholder = 'zsh'
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finishRename(tab.id, input.value)
            if (currentPane) render(currentPane)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            renamingTabId = null
            if (currentPane) render(currentPane)
          }
        })
        input.addEventListener('blur', () => {
          if (renamingTabId === tab.id) {
            finishRename(tab.id, input.value)
            if (currentPane) render(currentPane)
          }
        })
        input.addEventListener('click', e => e.stopPropagation())
        tabEl.appendChild(input)
        setTimeout(() => { input.focus(); input.select() }, 0)
      } else {
        const label = document.createElement('span')
        label.className = 'tab-label'
        label.textContent = tab.customName ?? 'zsh'
        tabEl.appendChild(label)

        const closeBtn = document.createElement('button')
        closeBtn.className = 'tab-close'
        closeBtn.textContent = '×'
        closeBtn.setAttribute('aria-label', 'Close tab')
        closeBtn.addEventListener('click', e => { e.stopPropagation(); cb.onClose(tab.id) })
        tabEl.appendChild(closeBtn)

        tabEl.addEventListener('click', () => cb.onActivate(tab.id))
        tabEl.addEventListener('contextmenu', e => {
          e.preventDefault()
          cb.onContextMenu(tab.id, e.clientX, e.clientY)
        })
        tabEl.addEventListener('dblclick', () => {
          renamingTabId = tab.id
          if (currentPane) render(currentPane)
        })

        // Drag-and-drop reordering. Only attach when the tab is NOT in
        // rename mode — the <input> inside would otherwise lose its drag
        // default behaviour (text selection) to the tab's drag handlers.
        tabEl.draggable = true
        tabEl.addEventListener('dragstart', e => {
          draggingTabId = tab.id
          tabEl.classList.add('is-dragging')
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move'
            // Must set data or Firefox won't start the drag.
            e.dataTransfer.setData('text/plain', tab.id)
            // Also record which pane this drag originated from so cross-pane
            // drops can be detected in the drop handler.
            e.dataTransfer.setData('application/x-youterm-pane', String(paneIndex))
          }
        })
        tabEl.addEventListener('dragend', () => {
          draggingTabId = null
          tabEl.classList.remove('is-dragging')
          clearDropMarkers()
          // Global cleanup: dragend reliably fires on the source regardless of
          // where (or whether) the drop lands, so this is the safest hook for
          // clearing residual drop-target highlights across every pane.
          document.querySelectorAll('.is-drop-target, .is-drop-target-pane').forEach(el => {
            el.classList.remove('is-drop-target', 'is-drop-target-pane')
          })
        })
        tabEl.addEventListener('dragover', e => {
          // During dragover, dataTransfer.getData() returns '' for security
          // reasons (values are only readable on drop). Types are readable
          // though, so we use the presence of 'text/plain' as a signal that
          // this is a youterm tab drag rather than an unrelated drop. This
          // also lets cross-pane drags through — draggingTabId is a closure
          // variable local to each tabBar instance and is null in the target
          // pane.
          if (!e.dataTransfer?.types.includes('text/plain')) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          // Split the hovered tab horizontally at its midpoint to decide
          // whether the drop would land before or after it.
          const rect = tabEl.getBoundingClientRect()
          const isBefore = e.clientX < rect.left + rect.width / 2
          clearDropMarkers()
          tabEl.classList.add(isBefore ? 'drop-before' : 'drop-after')
        })
        tabEl.addEventListener('dragleave', e => {
          // Only clear when the cursor actually left this tab (dragleave
          // also fires when moving onto a child node).
          if (!tabEl.contains(e.relatedTarget as Node | null)) {
            tabEl.classList.remove('drop-before', 'drop-after')
          }
        })
        tabEl.addEventListener('drop', e => {
          const sourceTabId = e.dataTransfer?.getData('text/plain') ?? draggingTabId
          const sourcePaneStr = e.dataTransfer?.getData('application/x-youterm-pane') ?? ''
          const sourcePaneIdx = sourcePaneStr === '' ? paneIndex : Number(sourcePaneStr) as 0 | 1
          if (!sourceTabId) return
          if (sourceTabId === tab.id && sourcePaneIdx === paneIndex) return
          e.preventDefault()
          e.stopPropagation()
          const rect = tabEl.getBoundingClientRect()
          const isBefore = e.clientX < rect.left + rect.width / 2
          // "before this tab" / "before the tab right after this one" — if
          // the target is already the last tab and we're dropping after,
          // pass null so the item goes to the end.
          let beforeId: string | null
          if (isBefore) {
            beforeId = tab.id
          } else {
            const tabs = currentPane?.tabs ?? []
            const idx = tabs.findIndex(t => t.id === tab.id)
            beforeId = idx >= 0 && idx + 1 < tabs.length ? tabs[idx + 1].id : null
          }
          draggingTabId = null
          clearDropMarkers()
          if (sourcePaneIdx === paneIndex) {
            cb.onMove(sourceTabId, beforeId)
          } else {
            cb.onMoveAcross(sourceTabId, beforeId)
          }
        })
      }

      list.appendChild(tabEl)
    }
  }

  // Note: tab-bar-level dragover/drop were removed in v0.16.4 — the pane-
  // level handlers (in main.ts buildPaneDOM) cover the entire pane,
  // including the tab-bar empty area. Individual .tab elements still
  // handle their own precise-insert drops via stopPropagation.

  const startRename = (tabId: string) => {
    renamingTabId = tabId
    if (currentPane) render(currentPane)
  }

  const setActive = (active: boolean) => {
    container.classList.toggle('is-pane-active', active)
  }

  return { render, startRename, setActive }
}
