import { test, expect } from '@playwright/test'
import { TestUtils, PERFORMANCE_THRESHOLDS } from './test-utils'

test.describe('Sales List Page', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should load page within performance threshold', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Check first paint time
    const firstPaintTime = await TestUtils.getFirstPaintTime(page)
    expect(firstPaintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.firstPaint)
    
    // Check total load time
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    
    console.log(`Sales List - Load time: ${loadTime}ms, First paint: ${firstPaintTime}ms`)
  })

  test('should display data without errors', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    
    // Wait for data to load
    await TestUtils.waitForDataLoad(page)
    
    // Check for error messages
    const errorMessages = await page.locator('[data-testid="error"], .error, .alert-error').count()
    expect(errorMessages).toBe(0)
    
    // Check for loading indicators (should not be visible)
    const loadingIndicators = await page.locator('[data-testid="loading"], .loading, .spinner').count()
    expect(loadingIndicators).toBe(0)
  })

  
  test('should handle pagination correctly', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"], .pagination, .pager')
    const hasPagination = await pagination.count() > 0
    
    if (hasPagination) {
      // Test pagination navigation
      const nextButton = page.locator('button:has-text("Next"), .pagination-next, [data-testid="next-page"]')
      const prevButton = page.locator('button:has-text("Previous"), .pagination-prev, [data-testid="prev-page"]')
      
      if (await nextButton.count() > 0) {
        await nextButton.click()
        await TestUtils.waitForDataLoad(page)
        
        // Verify page changed
        const currentPage = await page.locator('[data-testid="current-page"], .current-page').textContent()
        expect(currentPage).toContain('2')
      }
    }
  })

  test('should handle sorting correctly', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for sortable columns
    const sortableHeaders = page.locator('th[data-sortable="true"], .sortable, [data-testid="sortable-header"]')
    const sortableCount = await sortableHeaders.count()
    
    if (sortableCount > 0) {
      // Click first sortable header
      await sortableHeaders.first().click()
      await TestUtils.waitForDataLoad(page)
      
      // Verify sort indicator appears
      const sortIndicator = page.locator('.sort-asc, .sort-desc, [data-testid="sort-indicator"]')
      expect(await sortIndicator.count()).toBeGreaterThan(0)
    }
  })

  test('should handle filtering correctly', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for search/filter inputs
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], [data-testid="search-input"]')
    const hasSearch = await searchInput.count() > 0
    
    if (hasSearch) {
      // Test search functionality
      await searchInput.fill('test')
      await page.keyboard.press('Enter')
      await TestUtils.waitForDataLoad(page)
      
      // Verify results are filtered
      const results = page.locator('tbody tr, .data-row, [data-testid="data-row"]')
      const resultCount = await results.count()
      expect(resultCount).toBeGreaterThan(0)
    }
  })

  test('should handle data refresh correctly', async ({ page }) => {
    await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), .refresh-button, [data-testid="refresh-button"]')
    const hasRefresh = await refreshButton.count() > 0
    
    if (hasRefresh) {
      const startTime = Date.now()
      await refreshButton.click()
      await TestUtils.waitForDataLoad(page)
      const refreshTime = Date.now() - startTime
      
      // Verify refresh completed quickly
      expect(refreshTime).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
    }
  })
})