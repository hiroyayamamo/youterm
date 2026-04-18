import { describe, it, expect } from 'vitest'
import { validateAndNormalize } from '../../src/main/settingsStore'
import { INITIAL_SETTINGS } from '../../src/shared/types'

describe('validateAndNormalize', () => {
  it('passes through a fully valid Settings object (including blur)', () => {
    const valid = { transparency: 0.3, bgColor: 'dark-blue', lastMode: 'overlay', blur: 0.5, youtubeLastUrl: null, videoFillMode: false }
    expect(validateAndNormalize(valid)).toEqual(valid)
  })

  it('falls back to INITIAL_SETTINGS when input is null', () => {
    expect(validateAndNormalize(null)).toEqual(INITIAL_SETTINGS)
  })

  it('falls back to INITIAL_SETTINGS when input is not an object', () => {
    expect(validateAndNormalize('not an object')).toEqual(INITIAL_SETTINGS)
  })

  it('replaces only transparency when it is out of range, keeps other valid fields', () => {
    const raw = { transparency: 2.0, bgColor: 'dark-blue', lastMode: 'terminal-only', blur: 0.4 }
    expect(validateAndNormalize(raw)).toEqual({
      transparency: INITIAL_SETTINGS.transparency,
      bgColor: 'dark-blue',
      lastMode: 'terminal-only',
      blur: 0.4,
      youtubeLastUrl: null,
      videoFillMode: false,
    })
  })

  it('replaces only bgColor when it is unknown, keeps other valid fields', () => {
    const raw = { transparency: 0.5, bgColor: 'hot-pink', lastMode: 'overlay', blur: 0.2 }
    expect(validateAndNormalize(raw)).toEqual({
      transparency: 0.5,
      bgColor: INITIAL_SETTINGS.bgColor,
      lastMode: 'overlay',
      blur: 0.2,
      youtubeLastUrl: null,
      videoFillMode: false,
    })
  })

  it('replaces only lastMode when it is unknown, keeps other valid fields', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'floating', blur: 0.2 }
    expect(validateAndNormalize(raw)).toEqual({
      transparency: 0.5,
      bgColor: 'black',
      lastMode: INITIAL_SETTINGS.lastMode,
      blur: 0.2,
      youtubeLastUrl: null,
      videoFillMode: false,
    })
  })

  it('replaces only blur when it is missing (backward compat with v0.2 settings.json)', () => {
    const raw = { transparency: 0.5, bgColor: 'dark-green', lastMode: 'terminal-only' }
    expect(validateAndNormalize(raw)).toEqual({
      transparency: 0.5,
      bgColor: 'dark-green',
      lastMode: 'terminal-only',
      blur: INITIAL_SETTINGS.blur,
      youtubeLastUrl: null,
      videoFillMode: false,
    })
  })

  it('replaces only blur when it is out of range, keeps other valid fields', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 2.5 }
    expect(validateAndNormalize(raw)).toEqual({
      transparency: 0.5,
      bgColor: 'black',
      lastMode: 'overlay',
      blur: INITIAL_SETTINGS.blur,
      youtubeLastUrl: null,
      videoFillMode: false,
    })
  })

  it('replaces transparency when it is not a number, keeps other valid fields', () => {
    const raw = { transparency: 'high', bgColor: 'black', lastMode: 'overlay', blur: 0.3 }
    expect(validateAndNormalize(raw)).toEqual({
      transparency: INITIAL_SETTINGS.transparency,
      bgColor: 'black',
      lastMode: 'overlay',
      blur: 0.3,
      youtubeLastUrl: null,
      videoFillMode: false,
    })
  })

  it('accepts a valid youtube URL as youtubeLastUrl', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: 'https://www.youtube.com/watch?v=abc' }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, videoFillMode: false })
  })

  it('defaults youtubeLastUrl to null when missing', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1 }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, youtubeLastUrl: null, videoFillMode: false })
  })

  it('defaults youtubeLastUrl to null when not a YouTube URL', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: 'https://example.com/evil' }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, youtubeLastUrl: null, videoFillMode: false })
  })

  it('defaults youtubeLastUrl to null when not a string', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: 42 }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, youtubeLastUrl: null, videoFillMode: false })
  })

  it('accepts youtu.be short URL', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: 'https://youtu.be/abc123' }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, videoFillMode: false })
  })

  it('accepts videoFillMode true', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: null, videoFillMode: true }
    expect(validateAndNormalize(raw)).toEqual(raw)
  })

  it('defaults videoFillMode to false when missing', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: null }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, videoFillMode: false })
  })

  it('defaults videoFillMode to false when not a boolean', () => {
    const raw = { transparency: 0.5, bgColor: 'black', lastMode: 'overlay', blur: 0.1, youtubeLastUrl: null, videoFillMode: 'yes' }
    expect(validateAndNormalize(raw)).toEqual({ ...raw, videoFillMode: false })
  })
})
