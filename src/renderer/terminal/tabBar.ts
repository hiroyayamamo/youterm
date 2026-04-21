import type { TabsState } from '../../shared/types'

export interface TabBarCallbacks {
  onNewTab(): void
  onActivate(tabId: string): void
  onClose(tabId: string): void
  onContextMenu(tabId: string, x: number, y: number): void
  onRenameCommit(tabId: string, name: string | null): void
  onMove(tabId: string, beforeTabId: string | null): void
}

export interface TabBarHandle {
  render(state: TabsState): void
  startRename(tabId: string): void
}

export function createTabBar(container: HTMLElement, cb: TabBarCallbacks): TabBarHandle {
  const list = document.createElement('div')
  list.id = 'tab-list'
  container.appendChild(list)

  const newBtn = document.createElement('button')
  newBtn.id = 'tab-new'
  newBtn.textContent = '+'
  newBtn.setAttribute('aria-label', 'New tab')
  newBtn.addEventListener('click', e => { e.stopPropagation(); cb.onNewTab() })
  container.appendChild(newBtn)

  let currentState: TabsState | null = null
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

  const render = (state: TabsState) => {
    currentState = state
    list.innerHTML = ''
    for (const tab of state.tabs) {
      const tabEl = document.createElement('div')
      tabEl.className = 'tab'
      tabEl.dataset.tabId = tab.id
      if (tab.id === state.activeId) tabEl.classList.add('is-active')

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
            if (currentState) render(currentState)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            renamingTabId = null
            if (currentState) render(currentState)
          }
        })
        input.addEventListener('blur', () => {
          if (renamingTabId === tab.id) {
            finishRename(tab.id, input.value)
            if (currentState) render(currentState)
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
          if (currentState) render(currentState)
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
          }
        })
        tabEl.addEventListener('dragend', () => {
          draggingTabId = null
          tabEl.classList.remove('is-dragging')
          clearDropMarkers()
        })
        tabEl.addEventListener('dragover', e => {
          if (!draggingTabId || draggingTabId === tab.id) return
          e.preventDefault()
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
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
          if (!draggingTabId || draggingTabId === tab.id) return
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
            const tabs = currentState?.tabs ?? []
            const idx = tabs.findIndex(t => t.id === tab.id)
            beforeId = idx >= 0 && idx + 1 < tabs.length ? tabs[idx + 1].id : null
          }
          const dragged = draggingTabId
          draggingTabId = null
          clearDropMarkers()
          cb.onMove(dragged, beforeId)
        })
      }

      list.appendChild(tabEl)
    }
  }

  const startRename = (tabId: string) => {
    renamingTabId = tabId
    if (currentState) render(currentState)
  }

  return { render, startRename }
}
