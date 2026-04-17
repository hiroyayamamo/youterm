import { describe, it, expect } from 'vitest'
import { validateAndNormalize, type StoreRawReader } from '../../src/main/settingsStore'
import { INITIAL_SETTINGS } from '../../src/shared/types'

describe('validateAndNormalize', () => {
  it('passes through a valid Settings object', () => {
    const valid = { transparency: 0.3, bgColor: 'dark-blue', lastMode: 'overlay' }
    expect(validateAndNormalize(valid)).toEqual(valid)
  })

  it('falls back to INITIAL_SETTINGS when input is null', () => {
    expect(validateAndNormalize(null)).toEqual(INITIAL_SETTINGS)
  })

  it('falls back when transparency is out of range', () => {
    const invalid = { transparency: 2.0, bgColor: 'black', lastMode: 'overlay' }
    expect(validateAndNormalize(invalid)).toEqual(INITIAL_SETTINGS)
  })

  it('falls back when bgColor is unknown', () => {
    const invalid = { transparency: 0.5, bgColor: 'hot-pink', lastMode: 'overlay' }
    expect(validateAndNormalize(invalid)).toEqual(INITIAL_SETTINGS)
  })

  it('falls back when lastMode is unknown', () => {
    const invalid = { transparency: 0.5, bgColor: 'black', lastMode: 'floating' }
    expect(validateAndNormalize(invalid)).toEqual(INITIAL_SETTINGS)
  })

  it('falls back when transparency is not a number', () => {
    const invalid = { transparency: 'high', bgColor: 'black', lastMode: 'overlay' }
    expect(validateAndNormalize(invalid)).toEqual(INITIAL_SETTINGS)
  })
})
