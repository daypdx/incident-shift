import { beforeEach, describe, expect, it } from 'vitest'
import { scenarioById } from '../content/generated'
import { acceptCase, applyAction, scoreAttempt } from './engine'
import { loadAttempt, loadHistory, loadSettings, migratePersistedAttempt, recordCompletion, saveAttempt } from './persistence'

describe('event-log persistence', () => {
  beforeEach(() => localStorage.clear())

  it('restores the exact attempt from events', () => {
    const scenario = scenarioById.get('TRAIN-001')!
    const accepted = acceptCase(scenario, 'independent', '2026-08-18T12:00:00.000Z')
    const state = applyAction(scenario, accepted, 'ask-audio-scope', '2026-08-18T12:00:01.000Z')
    expect(saveAttempt(state)).toBe(true)
    expect(loadAttempt(scenario)).toEqual(state)
  })

  it('archives incompatible persistence shapes by rejecting migration', () => {
    expect(migratePersistedAttempt({ dataVersion: 0, events: [] })).toBeNull()
    expect(migratePersistedAttempt({ dataVersion: 1, events: [] })).toEqual({ dataVersion: 1, events: [] })
  })

  it('drops the retired sound preference and stores private progress dimensions', () => {
    localStorage.setItem('incident-shift.settings.v1', JSON.stringify({ defaultMode: 'independent', reducedMotion: true, highContrast: false, sound: true }))
    expect(loadSettings()).toEqual({ defaultMode: 'independent', reducedMotion: true, highContrast: false })
    const scenario = scenarioById.get('SD-001')!
    const state = acceptCase(scenario, 'coach', '2026-08-18T12:00:00.000Z')
    recordCompletion(scenario, state, scoreAttempt(scenario, state), [])
    expect(loadHistory()[0]?.dimensions).toBeDefined()
  })
})
