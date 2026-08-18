import { describe, expect, it } from 'vitest'
import { scenarioById } from '../content/generated'
import { acceptCase, applyAction, classifyEvidence, commitCommunication, commitDecision, commitResolution, commitVerification, DomainError, replay, scoreAttempt, type AttemptState } from './engine'

const dns = scenarioById.get('SD-001')!
const at = '2026-08-18T12:00:00.000Z'

function investigated(prohibited = false) {
  let state = acceptCase(dns, 'coach', at)
  if (prohibited) state = applyAction(dns, state, 'restart-router', at)
  for (const actionId of dns.debrief.bestPathActionIds) state = applyAction(dns, state, actionId, at)
  state = classifyEvidence(dns, state, 'dns-timeout', 'stale-dns', 'supports', at)
  state = classifyEvidence(dns, state, 'public-ip-success', 'organization-outage', 'contradicts', at)
  return state
}

function completed(prohibited = false, unsupported = false) {
  let state = investigated(prohibited)
  state = commitDecision(dns, state, 'decide-stale-dns', 'high', 'verify-resolution-and-outcome', at)
  state = commitResolution(dns, state, 'restore-approved-dns', at)
  state = commitVerification(dns, state, 'verify-resolution-and-outcome', at)
  const parts = [...dns.communication.requiredMessageParts]
  if (unsupported) parts.push('msg-unsupported')
  return commitCommunication(dns, state, parts, at)
}

describe('deterministic event engine', () => {
  it('enforces action prerequisites and prevents duplicate actions/evidence scoring', () => {
    const initial = acceptCase(dns, 'coach', at)
    expect(() => applyAction(dns, initial, 'test-public-ip', at)).toThrowError(DomainError)
    const once = applyAction(dns, initial, 'inspect-ip', at)
    expect(() => applyAction(dns, once, 'inspect-ip', at)).toThrowError(/only be taken once/)
    expect(new Set(once.collectedEvidenceIds).size).toBe(once.collectedEvidenceIds.length)
  })

  it('requires evidence classification, a verification plan, and an addressed alternative for high confidence', () => {
    let state = acceptCase(dns, 'coach', at)
    state = applyAction(dns, state, 'inspect-ip', at)
    expect(() => commitDecision(dns, state, 'decide-stale-dns', 'moderate', 'verify-resolution-and-outcome', at)).toThrow(/More investigation/)
    state = investigated()
    const withoutAlternative = { ...state, classifications: state.classifications.filter((item) => item.relation !== 'contradicts') } as AttemptState
    expect(() => commitDecision(dns, withoutAlternative, 'decide-stale-dns', 'high', 'verify-resolution-and-outcome', at)).toThrow(/alternative/)
    expect(() => commitDecision(dns, state, 'decide-stale-dns', 'moderate', 'missing-plan', at)).toThrow(/verification plan/i)
  })

  it('scores authored evidence relations and replays identically from immutable events', () => {
    const state = completed()
    const replayed = replay(state.events, dns)
    expect(replayed).toEqual(state)
    expect(scoreAttempt(dns, replayed)).toEqual(scoreAttempt(dns, state))
    expect(scoreAttempt(dns, state).ledger.some((entry) => entry.source.includes('Evidence classification'))).toBe(true)
  })

  it('caps a completed prohibited action at 59 and explains it', () => {
    const score = scoreAttempt(dns, completed(true))
    expect(score.finalScore).toBeLessThanOrEqual(59)
    expect(score.caps.some((cap) => cap.id === 'critical-safety')).toBe(true)
  })

  it('caps unsupported certainty in communication at 49', () => {
    const score = scoreAttempt(dns, completed(false, true))
    expect(score.dimensions.communication).toBeLessThanOrEqual(49)
    expect(score.unsupportedStatements).toHaveLength(1)
  })
})
