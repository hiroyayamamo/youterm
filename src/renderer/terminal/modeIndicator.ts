import type { AppState } from '../../shared/types'

export function createModeIndicator(parent: HTMLElement) {
  const el = document.createElement('div')
  el.id = 'mode-indicator'
  parent.appendChild(el)

  return {
    update(state: AppState) {
      const modeLabel =
        state.mode === 'youtube-only'
          ? 'YT'
          : state.mode === 'terminal-only'
            ? 'TERM'
            : 'OVERLAY'
      const target = state.mode === 'overlay' ? ` · ${state.inputTarget}` : ''
      el.textContent = `${modeLabel}${target}`
    },
  }
}
