import { describe, expect, it } from 'vitest'
import { scenarioById } from '../content/generated'
import { ContentValidationError, validateScenario, validateScenarioCollection } from './validation'

const dns = scenarioById.get('SD-001')!
const today = new Date('2026-08-18T12:00:00Z')

describe('scenario content contract', () => {
  it('accepts every supplied and authored scenario', () => {
    expect(() => validateScenarioCollection([...scenarioById.values()], today)).not.toThrow()
  })

  it.each([
    ['duplicate IDs', (copy: any) => { copy.evidence[1].id = copy.evidence[0].id }],
    ['broken references', (copy: any) => { copy.actions[0].revealsEvidenceIds = ['missing-evidence'] }],
    ['wrong score weights', (copy: any) => { copy.scoring.dimensions[0].weight += 1 }],
    ['expired review dates', (copy: any) => { copy.contentReview.reviewBy = '2026-08-17' }],
    ['missing correct choices', (copy: any) => { copy.decision.options.forEach((option: any) => { option.isCorrect = false }) }],
  ])('rejects %s', (_label, mutate) => {
    const copy = structuredClone(dns)
    mutate(copy)
    expect(() => validateScenario(copy, today)).toThrow(ContentValidationError)
  })
})
