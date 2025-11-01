import { test, expect } from '@playwright/test'
import { TestUtils, PERFORMANCE_THRESHOLDS } from './test-utils'

test.describe('Inventory Corrections Page', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should load page within performance threshold', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/inventory-corrections`)
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Check first paint time
    const firstPaintTime = await TestUtils.getFirstPaintTime(page)
    expect(firstPaintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.firstPaint)
    
    // Check total load time
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    
    console.log(`Inventory Corrections - Load time: ${loadTime}ms, First paint: ${firstPaintTime}ms`)
  })

  test('should display data without errors', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/inventory-corrections`)
    
    // Wait for data to load
    await TestUtils.waitForDataLoad(page)
    
    // Check for error messages
    const errorMessages = await page.locator('[data-testid="error"], .error, .alert-error').count()
    expect(errorMessages).toBe(0)
    
    // Check for loading indicators (should not be visible)
    const loadingIndicators = await page.locator('[data-testid="loading"], .loading, .spinner').count()
    expect(loadingIndicators).toBe(0)
  })

  
  test('should display content without errors', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/inventory-corrections`)
    await TestUtils.waitForDataLoad(page)
    
    // Check for basic content
    const content = page.locator('main, .content, [data-testid="main-content"]')
    expect(await content.count()).toBeGreaterThan(0)
  })
})