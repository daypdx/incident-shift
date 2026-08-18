import { describe, expect, it } from 'vitest'
import { scenarios } from '../content/generated'
import { selectDailyScenario } from './selectors'

describe('daily incident selection', () => {
  it('is deterministic for a local-date input and respects eligibility', () => {
    const date = new Date('2026-08-18T12:00:00Z')
    expect(selectDailyScenario(scenarios, date)?.id).toBe(selectDailyScenario(scenarios, date)?.id)
    expect(selectDailyScenario(scenarios, date, ['SD-001'])?.id).toBe('SD-001')
    expect(selectDailyScenario(scenarios, date, [])).toBeNull()
  })
})
