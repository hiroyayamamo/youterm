import { describe, it, expect } from 'vitest'
import { transitionSettings, type SettingsAction } from '../../src/main/settings'
import type { Settings } from '../../src/shared/types'
import { INITIAL_SETTINGS } from '../../src/shared/types'

describe('transitionSettings', () => {
  describe('set-transparency', () => {
    it('updates transparency within range', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-transparency', value: 0.3 })
      expect(next.transparency).toBe(0.3)
    })
    it('clamps value above 0.9 down to 0.9', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-transparency', value: 1.5 })
      expect(next.transparency).toBe(0.9)
    })
    it('clamps negative value up to 0', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-transparency', value: -0.2 })
      expect(next.transparency).toBe(0)
    })
    it('returns same reference when value already equals current', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-transparency', value: 0.75 })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })

  describe('set-color', () => {
    it('updates bgColor to a valid ColorKey', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-color', color: 'dark-blue' })
      expect(next.bgColor).toBe('dark-blue')
    })
    it('returns same reference when color already equals current', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-color', color: 'black' })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })

  describe('set-blur', () => {
    it('updates blur within range', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-blur', value: 0.5 })
      expect(next.blur).toBe(0.5)
    })
    it('clamps value above 1 down to 1', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-blur', value: 1.5 })
      expect(next.blur).toBe(1)
    })
    it('clamps negative value up to 0', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-blur', value: -0.2 })
      expect(next.blur).toBe(0)
    })
    it('returns same reference when value already equals current', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-blur', value: 0.1 })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })

  describe('set-last-mode', () => {
    it('updates lastMode', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-last-mode', mode: 'terminal-only' })
      expect(next.lastMode).toBe('terminal-only')
    })
    it('returns same reference when mode equals current', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-last-mode', mode: 'overlay' })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })

  describe('reset', () => {
    it('returns INITIAL_SETTINGS regardless of current state', () => {
      const current: Settings = { transparency: 0.1, bgColor: 'dark-green', lastMode: 'youtube-only', blur: 0.5, youtubeLastUrl: 'https://www.youtube.com/watch?v=abc', videoFillMode: true }
      const next = transitionSettings(current, { type: 'reset' })
      expect(next).toEqual(INITIAL_SETTINGS)
    })
    it('returns the INITIAL_SETTINGS reference when already at initial', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'reset' })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })

  describe('set-youtube-url', () => {
    it('sets the URL', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-youtube-url', url: 'https://www.youtube.com/watch?v=abc' })
      expect(next.youtubeLastUrl).toBe('https://www.youtube.com/watch?v=abc')
    })
    it('sets null to clear', () => {
      const prev: Settings = { ...INITIAL_SETTINGS, youtubeLastUrl: 'https://www.youtube.com/watch?v=abc' }
      const next = transitionSettings(prev, { type: 'set-youtube-url', url: null })
      expect(next.youtubeLastUrl).toBeNull()
    })
    it('returns same reference when URL already equals current', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-youtube-url', url: null })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })

  describe('set-video-fill', () => {
    it('enables video fill mode', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-video-fill', value: true })
      expect(next.videoFillMode).toBe(true)
    })
    it('disables video fill mode', () => {
      const prev: Settings = { ...INITIAL_SETTINGS, videoFillMode: true }
      const next = transitionSettings(prev, { type: 'set-video-fill', value: false })
      expect(next.videoFillMode).toBe(false)
    })
    it('returns same reference when value already equals current', () => {
      const next = transitionSettings(INITIAL_SETTINGS, { type: 'set-video-fill', value: false })
      expect(next).toBe(INITIAL_SETTINGS)
    })
  })
})
