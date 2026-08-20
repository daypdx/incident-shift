import type { DimensionId, EvidenceRelation, Scenario } from './validation'

export type Mode = 'coach' | 'independent'
export type Confidence = 'low' | 'moderate' | 'high'
export type Stage = 'briefing' | 'triage' | 'investigate' | 'resolve' | 'verify' | 'communicate' | 'debrief'

export type AttemptEvent =
  | { type: 'case.accepted'; at: string; mode: Mode }
  | { type: 'action.taken'; at: string; actionId: string }
  | { type: 'evidence.classified'; at: string; evidenceId: string; hypothesisId: string; relation: EvidenceRelation }
  | { type: 'evidence.classification-removed'; at: string; evidenceId: string; hypothesisId: string }
  | { type: 'decision.committed'; at: string; optionId: string; confidence: Confidence; verificationPlanOptionId: string }
  | { type: 'resolution.committed'; at: string; optionId: string }
  | { type: 'verification.committed'; at: string; optionId: string }
  | { type: 'communication.committed'; at: string; messagePartIds: string[] }
  | { type: 'case.completed'; at: string }

export interface EvidenceClassification {
  evidenceId: string
  hypothesisId: string
  relation: EvidenceRelation
}

export interface ScoreLedgerEntry {
  source: string
  dimension: DimensionId
  amount: number
}

export interface ScoreCap {
  id: 'critical-safety' | 'safety' | 'authorization' | 'verification' | 'incorrect-commitment'
  maximum: number
  explanation: string
}

export interface ScoreResult {
  dimensions: Record<DimensionId, number>
  ledger: ScoreLedgerEntry[]
  rawScore: number
  finalScore: number
  rank: string
  caps: ScoreCap[]
  unscored: boolean
  unsupportedStatements: string[]
}

export interface AttemptState {
  dataVersion: 1
  scenarioId: string
  contentVersion: number
  mode: Mode
  stage: Stage
  collectedEvidenceIds: string[]
  usedActionIds: string[]
  classifications: EvidenceClassification[]
  decision?: { optionId: string; confidence: Confidence; verificationPlanOptionId: string }
  resolutionOptionId?: string
  verificationOptionId?: string
  messagePartIds: string[]
  events: AttemptEvent[]
  moves: number
  disruption: number
}

export class DomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

const now = () => new Date().toISOString()
const unique = <T,>(values: T[]) => [...new Set(values)]

function emptyState(scenario: Scenario, mode: Mode): AttemptState {
  return {
    dataVersion: 1,
    scenarioId: scenario.id,
    contentVersion: scenario.version,
    mode,
    stage: 'briefing',
    collectedEvidenceIds: [],
    usedActionIds: [],
    classifications: [],
    messagePartIds: [],
    events: [],
    moves: 0,
    disruption: 0,
  }
}

function reduceEvent(scenario: Scenario, state: AttemptState, event: AttemptEvent): AttemptState {
  const next = { ...state, events: [...state.events, event] }
  switch (event.type) {
    case 'case.accepted':
      return { ...next, mode: event.mode, stage: 'triage', collectedEvidenceIds: [...scenario.briefing.initialEvidenceIds] }
    case 'action.taken': {
      const action = scenario.actions.find((item) => item.id === event.actionId)
      if (!action) throw new DomainError('unknown-action', `Unknown action: ${event.actionId}`)
      return {
        ...next,
        stage: 'investigate',
        usedActionIds: [...state.usedActionIds, action.id],
        collectedEvidenceIds: unique([...state.collectedEvidenceIds, ...action.revealsEvidenceIds]),
        moves: state.moves + action.moveCost,
        disruption: state.disruption + action.disruptionCost,
      }
    }
    case 'evidence.classified':
      return {
        ...next,
        classifications: [
          ...state.classifications.filter((item) => item.evidenceId !== event.evidenceId || item.hypothesisId !== event.hypothesisId),
          { evidenceId: event.evidenceId, hypothesisId: event.hypothesisId, relation: event.relation },
        ],
      }
    case 'evidence.classification-removed':
      return { ...next, classifications: state.classifications.filter((item) => item.evidenceId !== event.evidenceId || item.hypothesisId !== event.hypothesisId) }
    case 'decision.committed':
      return { ...next, stage: 'resolve', decision: { optionId: event.optionId, confidence: event.confidence, verificationPlanOptionId: event.verificationPlanOptionId } }
    case 'resolution.committed':
      return { ...next, stage: 'verify', resolutionOptionId: event.optionId }
    case 'verification.committed':
      return { ...next, stage: 'communicate', verificationOptionId: event.optionId }
    case 'communication.committed':
      return { ...next, messagePartIds: [...event.messagePartIds] }
    case 'case.completed':
      return { ...next, stage: 'debrief' }
  }
}

function assertAttempt(scenario: Scenario, state: AttemptState) {
  if (state.scenarioId !== scenario.id || state.contentVersion !== scenario.version) {
    throw new DomainError('content-mismatch', 'This attempt belongs to a different scenario version.')
  }
}

export function acceptCase(scenario: Scenario, mode: Mode, at = now()): AttemptState {
  return reduceEvent(scenario, emptyState(scenario, mode), { type: 'case.accepted', at, mode })
}

export function getAvailableActions(scenario: Scenario, state: AttemptState) {
  assertAttempt(scenario, state)
  return scenario.actions.map((action) => ({
    action,
    available: !state.usedActionIds.includes(action.id) && action.requiresEvidenceIds.every((id) => state.collectedEvidenceIds.includes(id)) && ['triage', 'investigate'].includes(state.stage),
    missingEvidenceIds: action.requiresEvidenceIds.filter((id) => !state.collectedEvidenceIds.includes(id)),
  }))
}

export function applyAction(scenario: Scenario, state: AttemptState, actionId: string, at = now()): AttemptState {
  assertAttempt(scenario, state)
  const availability = getAvailableActions(scenario, state).find((item) => item.action.id === actionId)
  if (!availability) throw new DomainError('unknown-action', `Unknown action: ${actionId}`)
  if (state.usedActionIds.includes(actionId)) throw new DomainError('duplicate-action', 'An action can only be taken once.')
  if (!availability.available) throw new DomainError('action-locked', `Action prerequisites are missing: ${availability.missingEvidenceIds.join(', ')}`)
  return reduceEvent(scenario, state, { type: 'action.taken', at, actionId })
}

export function classifyEvidence(scenario: Scenario, state: AttemptState, evidenceId: string, hypothesisId: string, relation: EvidenceRelation, at = now()): AttemptState {
  assertAttempt(scenario, state)
  if (!state.collectedEvidenceIds.includes(evidenceId)) throw new DomainError('evidence-locked', 'Collect evidence before classifying it.')
  if (!scenario.hypotheses.some((item) => item.id === hypothesisId)) throw new DomainError('unknown-hypothesis', `Unknown hypothesis: ${hypothesisId}`)
  if (state.classifications.some((item) => item.evidenceId === evidenceId && item.hypothesisId === hypothesisId && item.relation === relation)) return state
  return reduceEvent(scenario, state, { type: 'evidence.classified', at, evidenceId, hypothesisId, relation })
}

export function removeEvidenceClassification(scenario: Scenario, state: AttemptState, evidenceId: string, hypothesisId: string, at = now()): AttemptState {
  assertAttempt(scenario, state)
  if (!state.classifications.some((item) => item.evidenceId === evidenceId && item.hypothesisId === hypothesisId)) throw new DomainError('unknown-classification', 'That evidence relationship is not currently classified.')
  return reduceEvent(scenario, state, { type: 'evidence.classification-removed', at, evidenceId, hypothesisId })
}

export function commitDecision(scenario: Scenario, state: AttemptState, optionId: string, confidence: Confidence, verificationPlanOptionId: string, at = now()): AttemptState {
  assertAttempt(scenario, state)
  if (!['triage', 'investigate'].includes(state.stage)) throw new DomainError('wrong-stage', 'The decision is not available at this stage.')
  const option = scenario.decision.options.find((item) => item.id === optionId)
  if (!option) throw new DomainError('unknown-option', `Unknown decision option: ${optionId}`)
  const verificationPlan = scenario.verification.options.find((item) => item.id === verificationPlanOptionId)
  if (!verificationPlan) throw new DomainError('verification-plan-required', 'Select a verification plan before committing.')
  const missing = option.requiresEvidenceIds.filter((id) => !state.collectedEvidenceIds.includes(id))
  if (missing.length) throw new DomainError('decision-evidence-required', `More investigation is required before this claim: ${missing.join(', ')}`)
  const hasSupportingObservation = state.classifications.some((item) => item.relation === 'supports' && scenario.evidence.find((evidence) => evidence.id === item.evidenceId)?.provenance !== 'reported')
  if (!hasSupportingObservation) throw new DomainError('supporting-classification-required', 'Classify at least one collected observation as support before committing.')
  if (confidence === 'high' && !state.classifications.some((item) => item.relation === 'contradicts')) throw new DomainError('alternative-required', 'High confidence requires addressing an alternative or contradiction.')
  return reduceEvent(scenario, state, { type: 'decision.committed', at, optionId, confidence, verificationPlanOptionId })
}

export function commitResolution(scenario: Scenario, state: AttemptState, optionId: string, at = now()): AttemptState {
  assertAttempt(scenario, state)
  if (state.stage !== 'resolve') throw new DomainError('wrong-stage', 'Resolution follows a committed decision.')
  const option = scenario.resolution.options.find((item) => item.id === optionId)
  if (!option) throw new DomainError('unknown-option', `Unknown resolution option: ${optionId}`)
  const missing = option.requiresEvidenceIds.filter((id) => !state.collectedEvidenceIds.includes(id))
  if (missing.length) throw new DomainError('resolution-evidence-required', `Resolution evidence is missing: ${missing.join(', ')}`)
  return reduceEvent(scenario, state, { type: 'resolution.committed', at, optionId })
}

export function commitVerification(scenario: Scenario, state: AttemptState, optionId: string, at = now()): AttemptState {
  assertAttempt(scenario, state)
  if (state.stage !== 'verify') throw new DomainError('wrong-stage', 'Verification follows a committed resolution.')
  const option = scenario.verification.options.find((item) => item.id === optionId)
  if (!option) throw new DomainError('unknown-option', `Unknown verification option: ${optionId}`)
  const missing = option.requiresEvidenceIds.filter((id) => !state.collectedEvidenceIds.includes(id))
  if (missing.length) throw new DomainError('verification-evidence-required', `Verification prerequisites are missing: ${missing.join(', ')}`)
  return reduceEvent(scenario, state, { type: 'verification.committed', at, optionId })
}

export function commitCommunication(scenario: Scenario, state: AttemptState, messagePartIds: string[], at = now()): AttemptState {
  assertAttempt(scenario, state)
  if (state.stage !== 'communicate') throw new DomainError('wrong-stage', 'Communication follows verification.')
  const known = scenario.communication.availableMessageParts.map((item) => item.id)
  if (messagePartIds.some((id) => !known.includes(id))) throw new DomainError('unknown-message-part', 'The update contains an unknown message part.')
  const missing = scenario.communication.requiredMessageParts.filter((id) => !messagePartIds.includes(id))
  if (missing.length) throw new DomainError('message-incomplete', `The update is missing required parts: ${missing.join(', ')}`)
  const communicated = reduceEvent(scenario, state, { type: 'communication.committed', at, messagePartIds: unique(messagePartIds) })
  return reduceEvent(scenario, communicated, { type: 'case.completed', at })
}

export function replay(events: AttemptEvent[], scenario: Scenario): AttemptState {
  const first = events[0]
  if (!first || first.type !== 'case.accepted') throw new DomainError('invalid-event-log', 'An attempt must begin with case.accepted.')
  return events.reduce((state, event) => reduceEvent(scenario, state, event), emptyState(scenario, first.mode))
}

export function routeForAttempt(state: AttemptState) {
  const screen = state.stage === 'triage' || state.stage === 'investigate' ? 'play' : state.stage
  return `/case/${state.scenarioId}/${screen}`
}

export function getHypothesisStates(scenario: Scenario, state: AttemptState) {
  return scenario.hypotheses.map((hypothesis) => {
    const relations = state.classifications.filter((item) => item.hypothesisId === hypothesis.id).map((item) => item.relation)
    const supports = relations.includes('supports')
    const contradicts = relations.includes('contradicts')
    const playerState = supports && contradicts ? 'Mixed player evidence' : supports ? 'Player supports' : contradicts ? 'Player contradicts' : relations.includes('context') ? 'Player context only' : 'Unclassified'
    return { hypothesis, state: playerState }
  })
}

export function reviewedRelation(scenario: Scenario, evidenceId: string, hypothesisId: string): EvidenceRelation {
  const hypothesis = scenario.hypotheses.find((item) => item.id === hypothesisId)
  return hypothesis?.supportedBy.includes(evidenceId) ? 'supports' : hypothesis?.contradictedBy.includes(evidenceId) ? 'contradicts' : 'context'
}

export function getClassificationReview(scenario: Scenario, state: AttemptState) {
  return state.classifications.map((classification) => {
    const reviewed = reviewedRelation(scenario, classification.evidenceId, classification.hypothesisId)
    const revisions = state.events.filter((event) => event.type === 'evidence.classified' && event.evidenceId === classification.evidenceId && event.hypothesisId === classification.hypothesisId)
    const explanation = reviewed === 'supports' ? 'The reviewed relationship supports this hypothesis.' : reviewed === 'contradicts' ? 'The reviewed relationship weakens this hypothesis.' : 'The evidence provides context but does not directly prove or weaken this hypothesis.'
    return { ...classification, reviewed, correct: reviewed === classification.relation, revised: revisions.length > 1, explanation }
  })
}

export function hasEvidenceBasedRevision(scenario: Scenario, state: AttemptState) {
  const classified = state.events.map((event, index) => ({ event, index })).filter((item): item is { event: Extract<AttemptEvent, { type: 'evidence.classified' }>; index: number } => item.event.type === 'evidence.classified')
  return classified.some(({ event, index }, position) => {
    const previous = classified.slice(0, position).reverse().find((item) => item.event.evidenceId === event.evidenceId && item.event.hypothesisId === event.hypothesisId && item.event.relation !== event.relation)
    if (!previous) return false
    return state.events.slice(previous.index + 1, index).some((between) => between.type === 'action.taken' && (scenario.actions.find((action) => action.id === between.actionId)?.revealsEvidenceIds.length ?? 0) > 0)
  })
}

function applyEffects(ledger: ScoreLedgerEntry[], source: string, effects: Partial<Record<DimensionId, number>>) {
  for (const [dimension, amount] of Object.entries(effects) as [DimensionId, number][]) ledger.push({ source, dimension, amount })
}

export function scoreAttempt(scenario: Scenario, state: AttemptState): ScoreResult {
  assertAttempt(scenario, state)
  const ledger: ScoreLedgerEntry[] = []
  for (const actionId of state.usedActionIds) {
    const action = scenario.actions.find((item) => item.id === actionId)
    if (action) applyEffects(ledger, action.label, action.scoreEffects)
  }
  for (const classification of state.classifications) {
    const expected = reviewedRelation(scenario, classification.evidenceId, classification.hypothesisId)
    ledger.push({ source: `Evidence classification: ${classification.evidenceId}`, dimension: 'evidence', amount: expected === classification.relation ? 5 : -4 })
  }
  const decision = scenario.decision.options.find((item) => item.id === state.decision?.optionId)
  const resolution = scenario.resolution.options.find((item) => item.id === state.resolutionOptionId)
  const verification = scenario.verification.options.find((item) => item.id === state.verificationOptionId)
  if (decision) applyEffects(ledger, `Decision: ${decision.label}`, decision.scoreEffects)
  if (resolution) applyEffects(ledger, `Resolution: ${resolution.label}`, resolution.scoreEffects)
  if (verification) applyEffects(ledger, `Verification: ${verification.label}`, verification.scoreEffects)

  const unsupportedStatements = scenario.communication.availableMessageParts.filter((item) => state.messagePartIds.includes(item.id) && item.category === 'unsupported').map((item) => item.text)
  const requiredComplete = scenario.communication.requiredMessageParts.every((id) => state.messagePartIds.includes(id))
  if (requiredComplete) {
    ledger.push({ source: 'Complete evidence-bound update', dimension: 'communication', amount: 12 })
    ledger.push({ source: 'Complete evidence-bound update', dimension: 'closure', amount: 8 })
  }
  if (unsupportedStatements.length) ledger.push({ source: 'Unsupported certainty statement', dimension: 'communication', amount: -20 })

  const dimensionsResult = Object.fromEntries(scenario.scoring.dimensions.map((item) => [item.id, scenario.scoring.startingScore])) as Record<DimensionId, number>
  for (const entry of ledger) dimensionsResult[entry.dimension] = Math.max(0, Math.min(100, dimensionsResult[entry.dimension] + entry.amount))
  if (unsupportedStatements.length) dimensionsResult.communication = Math.min(49, dimensionsResult.communication)
  const rawScore = Math.round(scenario.scoring.dimensions.reduce((sum, item) => sum + dimensionsResult[item.id] * item.weight, 0) / 100)

  const caps: ScoreCap[] = []
  if (state.usedActionIds.some((id) => scenario.actions.find((item) => item.id === id)?.authorization === 'prohibited')) caps.push({ id: 'critical-safety', maximum: 59, explanation: 'A completed prohibited action triggered the critical safety cap.' })
  if (dimensionsResult.safety < 40) caps.push({ id: 'safety', maximum: 59, explanation: 'Safety fell below 40.' })
  if (dimensionsResult.authorization < 40) caps.push({ id: 'authorization', maximum: 59, explanation: 'Authorization fell below 40.' })
  if (!verification?.isCorrect) caps.push({ id: 'verification', maximum: 74, explanation: 'The original outcome or protective state was not correctly verified.' })
  if (!decision?.isCorrect || !resolution?.isCorrect || !verification?.isCorrect) caps.push({ id: 'incorrect-commitment', maximum: 89, explanation: 'Top rank requires correct decision, resolution, and verification commitments.' })
  const finalScore = caps.reduce((score, cap) => Math.min(score, cap.maximum), rawScore)
  const rank = [...scenario.scoring.rankBands].sort((a, b) => b.minimum - a.minimum).find((band) => finalScore >= band.minimum)?.label ?? 'Review the Path'
  return { dimensions: dimensionsResult, ledger, rawScore, finalScore, rank, caps, unscored: scenario.unscored, unsupportedStatements }
}

export function getDebrief(scenario: Scenario, state: AttemptState) {
  const score = scoreAttempt(scenario, state)
  return {
    score,
    rootCauseExplanation: scenario.debrief.rootCauseExplanation,
    teachingPoints: scenario.debrief.teachingPoints,
    bestPath: scenario.debrief.bestPathActionIds.map((id) => scenario.actions.find((item) => item.id === id)?.label ?? id),
    timeline: state.events,
  }
}
