import type { OptionsPanelHandle } from './optionsPanel'

export interface PanelController {
  toggle(): void
  close(): void
  open(): void
  isOpen(): boolean
}

export interface CreatePanelControllerDeps {
  panel: OptionsPanelHandle
  returnFocus: () => void
}

export function createPanelController(deps: CreatePanelControllerDeps): PanelController {
  let open = false

  const applyState = () => {
    deps.panel.element.classList.toggle('is-open', open)
    if (open) {
      deps.panel.focusFirstInput()
    } else {
      deps.returnFocus()
    }
  }

  const handleDocumentClick = (e: MouseEvent) => {
    if (!open) return
    // Clicks inside the panel have stopPropagation, so we only see outside clicks here
    const target = e.target as Node | null
    if (target && deps.panel.element.contains(target)) return
    open = false
    applyState()
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') {
      e.preventDefault()
      open = false
      applyState()
    }
  }

  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)

  return {
    toggle() { open = !open; applyState() },
    open() { open = true; applyState() },
    close() { open = false; applyState() },
    isOpen() { return open },
  }
}
