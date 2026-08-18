import { expect, test } from '@playwright/test'
import { acceptCase, scenario } from './helpers'

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth)
}

test('has no page-level horizontal scroll at 320px and uses an action sheet', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await expectNoPageOverflow(page)
  await acceptCase(page, scenario('TRAIN-001').id)
  await expectNoPageOverflow(page)
  await expect(page.locator('.action-drawer')).not.toBeInViewport()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await expect(page.locator('.action-drawer')).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Close actions' })).toBeVisible()
  await expectNoPageOverflow(page)
})

test('preserves controls at 200% browser zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/case/TRAIN-001/briefing')
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(page.getByRole('button', { name: 'Accept case' })).toBeVisible()
  await expectNoPageOverflow(page)
})
