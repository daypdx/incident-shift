import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { acceptCase, investigateBestPath, scenario } from './helpers'

async function expectAxeClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, `${label}: ${results.violations.map((item) => `${item.id} (${item.nodes.length})`).join(', ')}`).toEqual([])
}

test('axe smoke checks every major route', async ({ page }) => {
  await page.goto('/'); await expectAxeClean(page, 'landing')
  await page.goto('/shifts'); await expectAxeClean(page, 'shift board')
  await page.goto('/settings'); await expectAxeClean(page, 'settings')
  await page.goto('/progress'); await expectAxeClean(page, 'progress')

  const data = scenario('TRAIN-001')
  await page.goto('/case/TRAIN-001/briefing'); await expectAxeClean(page, 'briefing')
  await acceptCase(page, data.id); await expectAxeClean(page, 'active case')
  await investigateBestPath(page, data)
  await page.getByRole('button', { name: 'Commit decision' }).click(); await expectAxeClean(page, 'decision')
  await page.getByLabel(data.decision.options.find((item) => item.isCorrect)!.label).check()
  await page.getByLabel('Confidence').selectOption('high')
  await page.getByLabel('Verification plan').selectOption(data.verification.options.find((item) => item.isCorrect)!.id)
  await page.getByRole('button', { name: 'Commit decision', exact: false }).click(); await expectAxeClean(page, 'resolution')
  await page.getByLabel(data.resolution.options.find((item) => item.isCorrect)!.label).check()
  await page.getByRole('button', { name: 'Choose resolution' }).click(); await expectAxeClean(page, 'verification')
  await page.getByLabel(data.verification.options.find((item) => item.isCorrect)!.label).check()
  await page.getByRole('button', { name: 'Verify outcome' }).click(); await expectAxeClean(page, 'communication')
  for (const id of data.communication.requiredMessageParts) await page.getByLabel(data.communication.availableMessageParts.find((item) => item.id === id)!.text).check()
  await page.getByRole('button', { name: 'Complete handoff' }).click(); await expectAxeClean(page, 'debrief')
})

test('impact dialog returns focus to its trigger', async ({ page }) => {
  const data = scenario('SD-001')
  await acceptCase(page, data.id)
  const more = page.locator('.more-tests > summary')
  await more.click()
  const card = page.locator('.action-card').filter({ has: page.getByRole('heading', { name: data.actions.find((item) => item.id === 'restart-router')!.label }) })
  const trigger = card.getByRole('button', { name: 'Take action' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Go back' }).click()
  await expect(trigger).toBeFocused()
})

test('mobile Actions dialog is axe-clean while open', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await acceptCase(page, 'TRAIN-001')
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'What is your next test?' })).toBeVisible()
  await expectAxeClean(page, 'mobile actions open')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'What is your next test?' })).toHaveCount(0)
})
