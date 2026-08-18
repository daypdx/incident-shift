import { expect, test } from '@playwright/test'
import { acceptCase, classify, completeCase, finishCase, investigateBestPath, scenario, takeAction } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('completes Training Shift with keyboard-operable controls', async ({ page }) => {
  const data = scenario('TRAIN-001')
  await page.goto('/case/TRAIN-001/briefing')
  await page.getByRole('button', { name: 'Accept case' }).press('Enter')
  for (const id of data.debrief.bestPathActionIds) {
    const action = data.actions.find((item) => item.id === id)!
    const card = page.locator('.action-card').filter({ has: page.getByRole('heading', { name: action.label }) })
    await card.getByRole('button', { name: 'Take action' }).press('Enter')
  }
  await page.getByLabel('Evidence', { exact: true }).selectOption('selected-output')
  await page.getByLabel('Hypothesis', { exact: true }).selectOption('wrong-output')
  await page.getByRole('button', { name: 'Supports', exact: true }).press('Enter')
  await page.getByLabel('Evidence', { exact: true }).selectOption('scope-audio')
  await page.getByLabel('Hypothesis', { exact: true }).selectOption('driver-failure')
  await page.getByRole('button', { name: 'Contradicts', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Commit decision' }).press('Enter')
  await page.getByLabel(data.decision.options.find((item) => item.isCorrect)!.label).press('Space')
  await page.getByLabel('Confidence').selectOption('high')
  await page.getByLabel('Verification plan').selectOption(data.verification.options.find((item) => item.isCorrect)!.id)
  await page.getByRole('button', { name: 'Commit decision', exact: false }).press('Enter')
  await page.getByLabel(data.resolution.options.find((item) => item.isCorrect)!.label).press('Space')
  await page.getByRole('button', { name: 'Choose resolution' }).press('Enter')
  await page.getByLabel(data.verification.options.find((item) => item.isCorrect)!.label).press('Space')
  await page.getByRole('button', { name: 'Verify outcome' }).press('Enter')
  for (const id of data.communication.requiredMessageParts) {
    const part = data.communication.availableMessageParts.find((item) => item.id === id)!
    await page.getByLabel(part.text).press('Space')
  }
  await page.getByRole('button', { name: 'Complete handoff' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'You worked the complete incident loop.' })).toBeVisible()
})

test('completes SD-001 through the intended evidence path', async ({ page }) => {
  await completeCase(page, scenario('SD-001'))
  await expect(page.getByText(/No score cap/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A defensible investigation.' })).toBeVisible()
})

test('caps a prohibited SD-001 path at 59', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id)
  await takeAction(page, data, 'restart-router', true)
  await investigateBestPath(page, data)
  await finishCase(page, data)
  await expect(page.getByText('Maximum 59').first()).toBeVisible()
  await expect(page.getByText('A completed prohibited action triggered the critical safety cap.', { exact: true })).toBeVisible()
})

test('blocks a correct SD-001 guess without the commitment evidence gate', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id)
  await takeAction(page, data, 'inspect-ip')
  await classify(page, 'ip-config', 'stale-dns', 'Supports')
  await page.getByRole('button', { name: 'Commit decision' }).click()
  await page.getByLabel(data.decision.options.find((item) => item.isCorrect)!.label).check()
  await page.getByLabel('Verification plan').selectOption(data.verification.options.find((item) => item.isCorrect)!.id)
  await page.getByRole('button', { name: 'Commit decision', exact: false }).click()
  await expect(page.getByRole('alert')).toContainText('More investigation is required')
  await expect(page).toHaveURL(/\/decision$/)
})

test('closes ID-001 as a bounded benign event', async ({ page }) => {
  await completeCase(page, scenario('ID-001'), 'Independent')
  await expect(page.getByRole('heading', { name: 'A defensible investigation.' })).toBeVisible()
  await expect(page.getByText(/approved corporate VPN egress/i)).toBeVisible()
})

test('completes SOC-001 with correct escalation and handoff', async ({ page }) => {
  await completeCase(page, scenario('SOC-001'))
  await expect(page.getByText('Safe Escalation')).toBeVisible()
  await expect(page.getByText(/Security must continue the bounded investigation/i)).toBeVisible()
})

test('refreshes mid-case and continues with identical event-derived state', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id)
  await takeAction(page, data, 'ask-scope')
  await expect(page.getByRole('heading', { name: 'Scope response' })).toBeVisible()
  await expect(page.locator('.case-metrics span').first()).toContainText('1')
  const before = await page.evaluate(() => localStorage.getItem('incident-shift.attempt.SD-001.v1'))
  await page.reload()
  const after = await page.evaluate(() => localStorage.getItem('incident-shift.attempt.SD-001.v1'))
  expect(after).toBe(before)
  await expect(page.getByRole('heading', { name: 'Scope response' })).toBeVisible()
})
