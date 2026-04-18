import type { TabsState } from '../../shared/types'

export interface TabBarCallbacks {
  onNewTab(): void
  onActivate(tabId: string): void
  onClose(tabId: string): void
  onContextMenu(tabId: string, x: number, y: number): void
  onRenameCommit(tabId: string, name: string | null): void
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
