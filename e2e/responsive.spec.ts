import { expect, test } from '@playwright/test'
import { acceptCase, scenario } from './helpers'

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth)
}

test('mobile action sheet traps focus, closes safely, and preserves layout', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await expectNoPageOverflow(page)
    if (viewport.width === 320) {
      const cta = await page.getByRole('button', { name: /Start Training Shift/ }).boundingBox()
      expect(cta!.y + cta!.height).toBeLessThanOrEqual(viewport.height)
      await expect(page.locator('.global-header nav')).toContainText('Shifts')
      await expect(page.locator('.global-header nav')).toContainText('Settings')
    }
    await acceptCase(page, scenario('TRAIN-001').id)
    await expectNoPageOverflow(page)
    const drawer = page.locator('.action-drawer')
    const trigger = page.getByRole('button', { name: 'Actions', exact: true })
    await expect(drawer).not.toBeInViewport()
    if (viewport.width === 320) await trigger.press('Enter')
    else await trigger.click()
    await expect(drawer).toBeInViewport()
    const close = page.getByRole('button', { name: 'Close actions' })
    await expect(close).toBeFocused()
    expect(await page.locator('.workspace').evaluate((element) => (element as HTMLElement).inert)).toBe(true)
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.action-drawer')))).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.action-drawer')))).toBe(true)
    await drawer.evaluate((element) => { element.scrollTop = element.scrollHeight })
    const closeBox = await close.boundingBox()
    const drawerBox = await drawer.boundingBox()
    const navBox = await page.locator('.mobile-case-nav').boundingBox()
    expect(closeBox!.y).toBeGreaterThanOrEqual(drawerBox!.y)
    await expect(close).toBeInViewport()
    expect(drawerBox!.y + drawerBox!.height).toBeLessThanOrEqual(navBox!.y + 1)
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeInViewport()
    await expect(trigger).toBeFocused()
    expect(await page.locator('.workspace').evaluate((element) => (element as HTMLElement).inert)).toBe(false)
    await expectNoPageOverflow(page)
  }
})

test('preserves controls at 200% browser zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/case/TRAIN-001/briefing')
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(page.getByRole('button', { name: 'Accept case' })).toBeVisible()
  await expectNoPageOverflow(page)
})
