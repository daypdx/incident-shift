import { expect, test } from '@playwright/test'
import { acceptCase, classify, completeCase, finishCase, investigateBestPath, scenario, takeAction } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('completes Training Shift with keyboard-operable controls', async ({ page }) => {
  const browserProblems: string[] = []
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => browserProblems.push(`requestfailed: ${request.url()}`))
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`) })
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
  await expect(page.locator('.message-builder')).not.toContainText('UNSUPPORTED')
  await expect(page.locator('.message-builder .unsupported-part')).toHaveCount(0)
  await page.getByRole('button', { name: 'Complete handoff' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'You worked the complete incident loop.' })).toBeVisible()
  await expect(page.getByText('Your review reflects the path, commitments, verification, and handoff.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to your first scored case' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Independent mode/ })).toHaveCount(0)
  expect(browserProblems).toEqual([])
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
  await expect(page.getByText(/No score cap/)).toBeVisible()
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

test('exits and resumes an unfinished attempt without changing its event log', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id, 'Independent')
  await takeAction(page, data, 'ask-scope')
  await classify(page, 'scope-answer', 'organization-outage', 'Contradicts')
  const before = await page.evaluate(() => localStorage.getItem('incident-shift.attempt.SD-001.v1'))
  await page.getByRole('button', { name: 'Exit case and preserve progress' }).click()
  await expect(page.getByRole('button', { name: 'Resume case' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume case' }).click()
  await expect(page).toHaveURL(/\/case\/SD-001\/play$/)
  await expect(page.getByRole('heading', { name: 'Scope response' })).toBeVisible()
  await expect(page.getByText('Player contradicts')).toBeVisible()
  const after = await page.evaluate(() => localStorage.getItem('incident-shift.attempt.SD-001.v1'))
  expect(after).toBe(before)
})

test('requires confirmation before restarting an unfinished attempt', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id)
  await takeAction(page, data, 'ask-scope')
  const before = await page.evaluate(() => localStorage.getItem('incident-shift.attempt.SD-001.v1'))
  await page.goto('/case/SD-001/briefing')
  await page.getByRole('button', { name: 'Restart case', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Restart No Names/ })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep saved attempt' }).click()
  expect(await page.evaluate(() => localStorage.getItem('incident-shift.attempt.SD-001.v1'))).toBe(before)
  await page.getByRole('button', { name: 'Restart case', exact: true }).click()
  await dialog.getByRole('button', { name: 'Restart case', exact: true }).click()
  const restarted = await page.evaluate(() => JSON.parse(localStorage.getItem('incident-shift.attempt.SD-001.v1')!))
  expect(restarted.events).toHaveLength(1)
  expect(JSON.stringify(restarted)).not.toBe(before)
})

test('resumes resolve, verify, and communicate stages at their exact routes', async ({ page }) => {
  const at = '2026-08-18T12:00:00.000Z'
  const investigation = [
    { type: 'case.accepted', at, mode: 'coach' },
    { type: 'action.taken', at, actionId: 'ask-audio-scope' },
    { type: 'action.taken', at, actionId: 'inspect-output' },
    { type: 'action.taken', at, actionId: 'play-test-sound' },
    { type: 'evidence.classified', at, evidenceId: 'selected-output', hypothesisId: 'wrong-output', relation: 'supports' },
    { type: 'evidence.classified', at, evidenceId: 'scope-audio', hypothesisId: 'driver-failure', relation: 'contradicts' },
  ]
  const decision = { type: 'decision.committed', at, optionId: 'decide-wrong-output', confidence: 'high', verificationPlanOptionId: 'verify-test-call' }
  const resolution = { type: 'resolution.committed', at, optionId: 'select-headset' }
  const verification = { type: 'verification.committed', at, optionId: 'verify-test-call' }
  for (const entry of [
    { screen: 'resolve', events: [...investigation, decision] },
    { screen: 'verify', events: [...investigation, decision, resolution] },
    { screen: 'communicate', events: [...investigation, decision, resolution, verification] },
  ]) {
    await page.goto('/')
    await page.evaluate(({ events }) => { localStorage.clear(); localStorage.setItem('incident-shift.attempt.TRAIN-001.v1', JSON.stringify({ dataVersion: 1, scenarioId: 'TRAIN-001', contentVersion: 1, events })) }, entry)
    await page.goto('/shifts')
    await page.getByRole('button', { name: 'Resume case' }).click()
    await expect(page).toHaveURL(new RegExp(`/case/TRAIN-001/${entry.screen}$`))
  }
})

test('keeps authored hypothesis truth out of Independent mode', async ({ page }) => {
  for (const id of ['ID-001', 'SOC-001']) {
    await page.evaluate(() => localStorage.clear())
    const data = scenario(id)
    await acceptCase(page, id, 'Independent')
    await takeAction(page, data, data.debrief.bestPathActionIds[0]!)
    const rail = page.locator('.case-rail')
    await expect(rail).not.toContainText(/\bSupported\b|\bWeakened\b|\bPlausible\b/)
    await expect(rail.getByText('Unclassified', { exact: true }).first()).toBeVisible()
  }
})

test('gates Daily Incident until training or an explicit bypass', async ({ page }) => {
  await page.goto('/daily')
  await expect(page.getByRole('heading', { name: 'Learn the incident loop first.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Learn the loop first' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue without training' }).click()
  await expect(page.getByRole('button', { name: 'Accept case' })).toBeVisible()
  await page.evaluate(() => localStorage.setItem('incident-shift.progress.v1', JSON.stringify({ trainingComplete: true, completed: {} })))
  await page.goto('/daily')
  await expect(page.getByRole('heading', { name: 'Learn the incident loop first.' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Accept case' })).toBeVisible()
})

test('revises and removes a reasoning link from the visible ledger', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id)
  await classify(page, 'ticket-report', 'organization-outage', 'Supports')
  await takeAction(page, data, 'ask-scope')
  await page.getByLabel('Relation for Original user report and The organization\'s internet connection is down').selectOption('contradicts')
  await expect(page.getByText('Player contradicts')).toBeVisible()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('incident-shift.attempt.SD-001.v1')!))
  expect(stored.events.filter((event: { type: string }) => event.type === 'evidence.classified')).toHaveLength(2)
  await page.locator('.reasoning-ledger article').getByRole('button', { name: 'Remove' }).click()
  await expect(page.locator('.reasoning-ledger')).toHaveCount(0)
})

test('case-file controls move to evidence and open authority policy', async ({ page }) => {
  await acceptCase(page, 'TRAIN-001')
  await page.locator('.case-rail').getByRole('button', { name: /Evidence/ }).click()
  await expect(page.getByRole('heading', { name: 'Latest evidence' })).toBeFocused()
  const authorityTrigger = page.locator('.case-rail').getByRole('button', { name: /Authority/ })
  await authorityTrigger.click()
  const dialog = page.getByRole('dialog', { name: 'Authority boundaries' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Allowed' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Return to case' }).click()
  await expect(authorityTrigger).toBeFocused()
})

test('persists reduced-motion and increased-contrast preferences without a dead sound control', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('Reduce motion').check()
  await page.getByLabel('Increase contrast').check()
  await expect(page.getByLabel(/Sound/)).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
  await page.reload()
  await expect(page.getByLabel('Reduce motion')).toBeChecked()
  await expect(page.getByLabel('Increase contrast')).toBeChecked()
})
