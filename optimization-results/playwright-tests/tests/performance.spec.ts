import { test, expect } from '@playwright/test'
import { TestUtils, PERFORMANCE_THRESHOLDS } from './test-utils'

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should load all critical pages within performance threshold', async ({ page }) => {
    const criticalRoutes = [
      '/dashboard',
      '/dashboard/products',
      '/dashboard/sales',
      '/dashboard/purchases',
      '/dashboard/customers',
      '/dashboard/analytics-devextreme',
      '/dashboard/pos'
    ]

    for (const route of criticalRoutes) {
      const startTime = Date.now()
      
      await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}${route}`)
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      const firstPaintTime = await TestUtils.getFirstPaintTime(page)
      
      console.log(`${route} - Load: ${loadTime}ms, First paint: ${firstPaintTime}ms`)
      
      expect(firstPaintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.firstPaint)
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    }
  })

  test('should handle concurrent page loads efficiently', async ({ browser }) => {
    const context = await browser.newContext()
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ])

    // Login to all pages
    await Promise.all(pages.map(page => TestUtils.login(page)))

    // Load different pages concurrently
    const startTime = Date.now()
    await Promise.all([
      pages[0].goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`),
      pages[1].goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/products`),
      pages[2].goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    ])

    const totalTime = Date.now() - startTime
    
    // Concurrent loads should not take much longer than single load
    expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime * 1.5)
    
    await context.close()
  })

  test('should handle large data sets efficiently', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/products`)
    await TestUtils.waitForDataLoad(page)
    
    // Test with large page size
    const pageSizeSelect = page.locator('select[name="pageSize"], [data-testid="page-size-select"]')
    if (await pageSizeSelect.count() > 0) {
      await pageSizeSelect.selectOption('100')
      await TestUtils.waitForDataLoad(page)
      
      const loadTime = await TestUtils.measurePerformance(page, async () => {
        await page.waitForLoadState('networkidle')
      })
      
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    }
  })
})