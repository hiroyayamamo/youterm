import type { Settings, ColorKey } from '../../shared/types'

export interface OptionsPanelHandle {
  element: HTMLDivElement
  updateSettings(s: Settings): void
  focusFirstInput(): void
}

export interface OptionsPanelCallbacks {
  onTransparencyInput(value: number): void
  onBlurInput(value: number): void
  onColorSelect(color: ColorKey): void
  onReset(): void
}

const COLOR_KEYS: ColorKey[] = ['black', 'dark-gray', 'dark-blue', 'dark-green']

export function createOptionsPanel(callbacks: OptionsPanelCallbacks): OptionsPanelHandle {
  const panel = document.createElement('div')
  panel.id = 'options-panel'

  panel.innerHTML = `
    <div class="options-section">
      <label for="opt-transparency">Transparency</label>
      <input type="range" id="opt-transparency" min="0" max="0.9" step="0.05" />
      <span class="opt-value" id="opt-transparency-value">0.75</span>
    </div>

    <div class="options-section">
      <label for="opt-blur">Blur</label>
      <input type="range" id="opt-blur" min="0" max="1" step="0.05" />
      <span class="opt-value" id="opt-blur-value">10%</span>
    </div>

    <div class="options-section">
      <label>Background color</label>
      <div class="color-swatches">
        ${COLOR_KEYS.map(
          c => `<button class="swatch" data-color="${c}" aria-label="${c}"></button>`,
        ).join('')}
      </div>
    </div>

    <div class="options-footer">
      <button id="opt-reset" class="btn-reset">Reset</button>
      <span class="hint">Cmd+, to close</span>
    </div>
  `

  const slider = panel.querySelector<HTMLInputElement>('#opt-transparency')!
  const sliderValue = panel.querySelector<HTMLSpanElement>('#opt-transparency-value')!
  const blurSlider = panel.querySelector<HTMLInputElement>('#opt-blur')!
  const blurValue = panel.querySelector<HTMLSpanElement>('#opt-blur-value')!
  const swatches = panel.querySelectorAll<HTMLButtonElement>('.swatch')
  const resetBtn = panel.querySelector<HTMLButtonElement>('#opt-reset')!

  slider.addEventListener('input', () => {
    callbacks.onTransparencyInput(slider.valueAsNumber)
  })
  blurSlider.addEventListener('input', () => {
    callbacks.onBlurInput(blurSlider.valueAsNumber)
  })

  swatches.forEach(s => {
    s.addEventListener('click', e => {
      e.stopPropagation()
      const color = s.dataset.color as ColorKey
      if (color) callbacks.onColorSelect(color)
    })
  })

  resetBtn.addEventListener('click', e => {
    e.stopPropagation()
    callbacks.onReset()
  })

  // Prevent clicks inside the panel from bubbling to the document listener (used to close)
  panel.addEventListener('click', e => e.stopPropagation())

  return {
    element: panel,
    updateSettings(s: Settings) {
      slider.value = String(s.transparency)
      sliderValue.textContent = s.transparency.toFixed(2)
      blurSlider.value = String(s.blur)
      blurValue.textContent = `${Math.round(s.blur * 100)}%`
      swatches.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.color === s.bgColor)
      })
    },
    focusFirstInput() {
      slider.focus()
    },
  }
}
