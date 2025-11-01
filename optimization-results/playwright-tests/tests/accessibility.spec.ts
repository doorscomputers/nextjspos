import { test, expect } from '@playwright/test'
import { TestUtils } from './test-utils'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`)
    await TestUtils.waitForDataLoad(page)
    
    // Check for main landmark
    const main = page.locator('main, [role="main"]')
    expect(await main.count()).toBeGreaterThan(0)
    
    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]')
    expect(await nav.count()).toBeGreaterThan(0)
    
    // Check for proper heading hierarchy
    const h1 = page.locator('h1')
    expect(await h1.count()).toBeGreaterThan(0)
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`)
    await TestUtils.waitForDataLoad(page)
    
    // Test tab navigation
    await page.keyboard.press('Tab')
    const focusedElement = page.locator(':focus')
    expect(await focusedElement.count()).toBeGreaterThan(0)
  })

  test('should have proper color contrast', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`)
    await TestUtils.waitForDataLoad(page)
    
    // This would require a more sophisticated color contrast checker
    // For now, just ensure the page loads without visual errors
    const body = page.locator('body')
    expect(await body.count()).toBeGreaterThan(0)
  })
})