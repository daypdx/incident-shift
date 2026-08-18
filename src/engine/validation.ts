import { z } from 'zod'

const id = z.string().regex(/^[a-z][a-z0-9-]*$/)
const dimensions = ['scope', 'authorization', 'safety', 'information', 'efficiency', 'evidence', 'communication', 'verification', 'closure'] as const
const scoreEffects = z.partialRecord(z.enum(dimensions), z.number().int().min(-30).max(30)).default({})
const choiceOptionSchema = z.object({
  id,
  label: z.string().min(4).max(300),
  isCorrect: z.boolean(),
  requiresEvidenceIds: z.array(id).default([]),
  scoreEffects,
  feedback: z.string().max(800),
})

export const scenarioSchema = z.object({
  schemaVersion: z.literal('1.1'),
  artifactFamily: z.enum(['device-flow', 'connection-path', 'sign-in-timeline', 'email-call-timeline']),
  unscored: z.boolean(),
  id: z.string().regex(/^[A-Z]{2,5}-[0-9]{3}$/),
  version: z.number().int().positive(),
  title: z.string().min(4).max(80),
  subtitle: z.string().max(140).optional(),
  track: z.enum(['service-desk', 'network-operations', 'security-operations']),
  difficulty: z.enum(['rookie', 'technician', 'analyst']),
  estimatedMinutes: z.number().int().min(3).max(15),
  stability: z.enum(['evergreen', 'review-annually', 'review-quarterly']),
  contentReview: z.object({
    lastReviewed: z.iso.date(),
    reviewBy: z.iso.date(),
    sourceUrls: z.array(z.url()).min(1),
    reviewNotes: z.string().max(1000).optional(),
  }),
  playerRole: z.string().min(4).max(120),
  authorityScope: z.object({
    allowed: z.array(z.string().min(1)),
    requiresEscalation: z.array(z.string().min(1)),
    prohibited: z.array(z.string().min(1)),
  }),
  learningObjectives: z.array(z.string().min(8).max(180)).min(2).max(6),
  briefing: z.object({
    timestamp: z.string(),
    channel: z.enum(['ticket', 'alert', 'chat', 'phone', 'email']),
    requester: z.string().max(80),
    summary: z.string().min(20).max(800),
    initialEvidenceIds: z.array(id),
  }),
  evidence: z.array(z.object({
    id,
    label: z.string().max(80),
    type: z.enum(['user-report', 'observation', 'command-output', 'log', 'email', 'chat', 'policy', 'diagram', 'timeline']),
    provenance: z.enum(['reported', 'observed', 'system-generated', 'policy-defined']),
    content: z.string().max(3000),
    coachExplanation: z.string().max(600).optional(),
  })).min(3),
  hypotheses: z.array(z.object({
    id,
    label: z.string().max(120),
    isRootCause: z.boolean(),
    supportedBy: z.array(id),
    contradictedBy: z.array(id),
  })).min(3).max(8),
  actions: z.array(z.object({
    id,
    label: z.string().min(4).max(160),
    intent: z.enum(['ask', 'observe', 'test', 'change', 'escalate', 'communicate', 'verify']),
    phase: z.enum(['triage', 'investigate', 'resolve', 'verify']),
    moveCost: z.number().int().min(0).max(5),
    disruptionCost: z.number().int().min(0).max(5),
    authorization: z.enum(['allowed', 'requires-escalation', 'prohibited']),
    requiresEvidenceIds: z.array(id),
    revealsEvidenceIds: z.array(id),
    scoreEffects,
    immediateFeedback: z.string().max(600),
    coachHint: z.string().max(400).optional(),
  })).min(5).max(20),
  decision: z.object({ prompt: z.string().min(10).max(300), options: z.array(choiceOptionSchema).min(2).max(8) }),
  resolution: z.object({ prompt: z.string().min(10).max(300), options: z.array(choiceOptionSchema).min(2).max(8) }),
  verification: z.object({ prompt: z.string().min(10).max(300), options: z.array(choiceOptionSchema).min(2).max(8) }),
  communication: z.object({
    prompt: z.string().max(300),
    requiredMessageParts: z.array(id),
    availableMessageParts: z.array(z.object({
      id,
      text: z.string().max(400),
      category: z.enum(['scope', 'evidence', 'certainty', 'action', 'verification', 'closure', 'unsupported']),
    })).min(3),
  }),
  debrief: z.object({
    rootCauseExplanation: z.string().min(20).max(1200),
    bestPathActionIds: z.array(id),
    teachingPoints: z.array(z.string()),
    falseAssuranceWarnings: z.array(z.string()),
  }),
  scoring: z.object({
    startingScore: z.number().int().min(0).max(100),
    minimumScore: z.number().int().min(0).max(100),
    dimensions: z.array(z.object({ id: z.enum(dimensions), label: z.string(), weight: z.number().int().min(1).max(40) })).min(5),
    rankBands: z.array(z.object({ minimum: z.number().int().min(0).max(100), label: z.string().max(50) })).min(3),
  }),
}).strict()

export type Scenario = z.infer<typeof scenarioSchema>
export type DimensionId = typeof dimensions[number]
export type EvidenceRelation = 'supports' | 'contradicts' | 'context'

export class ContentValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues.join('\n'))
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

const duplicates = (values: string[]) => values.filter((value, index) => values.indexOf(value) !== index)

export function validateScenario(input: unknown, today = new Date()): Scenario {
  const scenario = scenarioSchema.parse(input)
  const issues: string[] = []
  const evidenceIds = scenario.evidence.map((item) => item.id)
  const actionIds = scenario.actions.map((item) => item.id)
  const hypothesisIds = scenario.hypotheses.map((item) => item.id)
  const optionIds = [...scenario.decision.options, ...scenario.resolution.options, ...scenario.verification.options].map((item) => item.id)
  const messageIds = scenario.communication.availableMessageParts.map((item) => item.id)

  for (const [label, values] of [['evidence', evidenceIds], ['action', actionIds], ['hypothesis', hypothesisIds], ['option', optionIds], ['message part', messageIds]] as const) {
    for (const duplicate of new Set(duplicates(values))) issues.push(`Duplicate ${label} ID: ${duplicate}`)
  }

  const requireRefs = (label: string, refs: string[], known: string[]) => {
    for (const ref of refs) if (!known.includes(ref)) issues.push(`${label} references missing ID: ${ref}`)
  }
  requireRefs('briefing', scenario.briefing.initialEvidenceIds, evidenceIds)
  for (const hypothesis of scenario.hypotheses) {
    requireRefs(`hypothesis ${hypothesis.id}`, [...hypothesis.supportedBy, ...hypothesis.contradictedBy], evidenceIds)
  }
  for (const action of scenario.actions) {
    requireRefs(`action ${action.id}`, [...action.requiresEvidenceIds, ...action.revealsEvidenceIds], evidenceIds)
  }
  for (const option of [...scenario.decision.options, ...scenario.resolution.options, ...scenario.verification.options]) {
    requireRefs(`option ${option.id}`, option.requiresEvidenceIds, evidenceIds)
  }
  requireRefs('best path', scenario.debrief.bestPathActionIds, actionIds)
  requireRefs('communication', scenario.communication.requiredMessageParts, messageIds)

  if (scenario.hypotheses.filter((item) => item.isRootCause).length !== 1) issues.push('Exactly one root cause is required')
  for (const [label, stage] of [['decision', scenario.decision], ['resolution', scenario.resolution], ['verification', scenario.verification]] as const) {
    if (stage.options.filter((option) => option.isCorrect).length !== 1) issues.push(`Exactly one correct ${label} option is required`)
  }
  if (scenario.scoring.dimensions.reduce((sum, item) => sum + item.weight, 0) !== 100) issues.push('Score weights must total 100')
  if (new Set(scenario.scoring.dimensions.map((item) => item.id)).size !== scenario.scoring.dimensions.length) issues.push('Duplicate scoring dimensions are not allowed')
  if (scenario.debrief.bestPathActionIds.some((actionId) => scenario.actions.find((item) => item.id === actionId)?.authorization === 'prohibited')) issues.push('Best path cannot contain a prohibited action')

  const lastReviewed = Date.parse(`${scenario.contentReview.lastReviewed}T00:00:00Z`)
  const reviewBy = Date.parse(`${scenario.contentReview.reviewBy}T23:59:59Z`)
  if (reviewBy < lastReviewed) issues.push('Review-by date cannot be earlier than last-reviewed date')
  if (reviewBy < today.getTime()) issues.push(`Content review expired on ${scenario.contentReview.reviewBy}`)
  for (const url of scenario.contentReview.sourceUrls) if (!url.startsWith('https://')) issues.push(`Source URL must use HTTPS: ${url}`)

  const text = JSON.stringify(scenario)
  if (/<\/?(?:script|iframe|object|embed|html|body)[^>]*>/i.test(text)) issues.push('Scriptable HTML content is not allowed')
  if (issues.length) throw new ContentValidationError(issues)
  return scenario
}

export function validateScenarioCollection(inputs: unknown[], today = new Date()): Scenario[] {
  const scenarios = inputs.map((input) => validateScenario(input, today))
  for (const duplicate of new Set(duplicates(scenarios.map((item) => item.id)))) {
    throw new ContentValidationError([`Duplicate scenario ID: ${duplicate}`])
  }
  return scenarios
}
