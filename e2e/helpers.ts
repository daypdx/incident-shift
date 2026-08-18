import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'

export type ScenarioData = {
  id: string
  title: string
  evidence: { id: string; provenance: string }[]
  debrief: { bestPathActionIds: string[] }
  actions: { id: string; label: string; authorization: string; revealsEvidenceIds: string[] }[]
  hypotheses: { id: string; isRootCause: boolean; supportedBy: string[]; contradictedBy: string[] }[]
  decision: { options: { id: string; label: string; isCorrect: boolean }[] }
  resolution: { options: { id: string; label: string; isCorrect: boolean }[] }
  verification: { options: { id: string; label: string; isCorrect: boolean }[] }
  communication: { requiredMessageParts: string[]; availableMessageParts: { id: string; text: string }[] }
}

export function scenario(id: string): ScenarioData {
  const directory = resolve('src/content/scenarios')
  const file = readdirSync(directory).find((name) => name.startsWith(id))
  if (!file) throw new Error(`Missing scenario fixture: ${id}`)
  return JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as ScenarioData
}

export async function acceptCase(page: Page, id: string, mode: 'Coach' | 'Independent' = 'Coach') {
  await page.goto(`/case/${id}/briefing`)
  if (mode === 'Independent') await page.getByLabel('Independent').check()
  await page.getByRole('button', { name: /Accept case|Restart case/ }).click()
  await page.getByRole('heading', { name: 'What is your next test?' }).waitFor()
}

export async function takeAction(page: Page, data: ScenarioData, actionId: string, confirm = false) {
  const action = data.actions.find((item) => item.id === actionId)
  if (!action) throw new Error(`Unknown action ${actionId}`)
  const card = page.locator('.action-card').filter({ has: page.getByRole('heading', { name: action.label }) })
  if (!(await card.isVisible())) {
    const actionsButton = page.getByRole('button', { name: 'Actions', exact: true })
    if (await actionsButton.isVisible().catch(() => false)) await actionsButton.click()
    const more = page.locator('.more-tests > summary')
    if (await more.isVisible()) await more.click()
  }
  await card.getByRole('button', { name: 'Take action' }).click()
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible().catch(() => false)) {
    if (!confirm) throw new Error(`Action ${actionId} unexpectedly requires confirmation`)
    await dialog.getByRole('button', { name: 'Take action anyway' }).click()
  }
}

export async function classify(page: Page, evidenceId: string, hypothesisId: string, relation: 'Supports' | 'Contradicts' | 'Context only') {
  await page.getByLabel('Evidence', { exact: true }).selectOption(evidenceId)
  await page.getByLabel('Hypothesis', { exact: true }).selectOption(hypothesisId)
  await page.getByRole('button', { name: relation, exact: true }).click()
}

export async function investigateBestPath(page: Page, data: ScenarioData) {
  for (const actionId of data.debrief.bestPathActionIds) await takeAction(page, data, actionId)
  const root = data.hypotheses.find((item) => item.isRootCause)!
  const collectedByBestPath = new Set(data.debrief.bestPathActionIds.flatMap((id) => data.actions.find((item) => item.id === id)?.revealsEvidenceIds ?? []))
  const supportingEvidence = root.supportedBy.find((id) => collectedByBestPath.has(id) && data.evidence.find((item) => item.id === id)?.provenance !== 'reported')
  if (!supportingEvidence) throw new Error(`No support evidence found for ${data.id}`)
  await classify(page, supportingEvidence, root.id, 'Supports')
  const alternative = data.hypotheses.find((item) => !item.isRootCause && item.contradictedBy.length)
  if (alternative) await classify(page, alternative.contradictedBy[0]!, alternative.id, 'Contradicts')
}

export async function completeCase(page: Page, data: ScenarioData, mode: 'Coach' | 'Independent' = 'Coach') {
  await acceptCase(page, data.id, mode)
  await investigateBestPath(page, data)
  await finishCase(page, data)
}

export async function finishCase(page: Page, data: ScenarioData) {
  await page.getByRole('button', { name: 'Commit decision' }).click()
  const decision = data.decision.options.find((item) => item.isCorrect)!
  const verification = data.verification.options.find((item) => item.isCorrect)!
  await page.getByLabel(decision.label).check()
  await page.getByLabel('Confidence').selectOption('high')
  await page.getByLabel('Verification plan').selectOption(verification.id)
  await page.getByRole('button', { name: 'Commit decision', exact: false }).click()
  const resolution = data.resolution.options.find((item) => item.isCorrect)!
  await page.getByLabel(resolution.label).check()
  await page.getByRole('button', { name: 'Choose resolution' }).click()
  await page.getByLabel(verification.label).check()
  await page.getByRole('button', { name: 'Verify outcome' }).click()
  for (const id of data.communication.requiredMessageParts) {
    const part = data.communication.availableMessageParts.find((item) => item.id === id)!
    await page.getByLabel(part.text).check()
  }
  await page.getByRole('button', { name: 'Complete handoff' }).click()
  await page.getByRole('heading', { name: /worked the complete incident loop|defensible investigation|review the path/i }).waitFor()
}
