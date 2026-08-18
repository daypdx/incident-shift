import { beforeEach, describe, expect, it } from 'vitest'
import { scenarioById } from '../content/generated'
import { acceptCase, applyAction } from './engine'
import { loadAttempt, migratePersistedAttempt, saveAttempt } from './persistence'

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
})
