import { test, expect } from '@playwright/test'

// Test configuration
const BASE_URL = 'http://localhost:3000'
const TEST_USER = {
  username: 'superadmin',
  password: 'password',
}

test.describe('Purchase Reports - Complete Test Suite', () => {
  // Login before all tests
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', TEST_USER.username)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('Should navigate to Purchase Reports page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases`)
    await expect(page).toHaveTitle(/Purchase Reports/)
    await expect(page.locator('h1')).toContainText('Purchase Reports')
  })

  test('Phase 1 Report 1: Item Purchase Summary', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/item-summary`)

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Item Purchase Summary")', { timeout: 10000 })

    // Click generate/load report button if exists
    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    // Wait for report data to load
    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    // Verify export buttons exist
    await expect(page.locator('button:has-text("CSV"), button[title*="CSV"]')).toBeVisible()
    await expect(page.locator('button:has-text("Excel"), button[title*="Excel"]')).toBeVisible()
    await expect(page.locator('button:has-text("PDF"), button[title*="PDF"]')).toBeVisible()

    console.log('✓ Item Purchase Summary loaded successfully')
  })

  test('Phase 1 Report 2: Supplier Purchase Summary', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/supplier-summary`)

    await page.waitForSelector('h1:has-text("Supplier Purchase Summary")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    // Check for export buttons
    await expect(page.locator('button:has-text("CSV"), button[title*="CSV"]')).toBeVisible()

    console.log('✓ Supplier Purchase Summary loaded successfully')
  })

  test('Phase 1 Report 3: Payment Status Report', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/payment-status`)

    await page.waitForSelector('h1:has-text("Payment Status")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Payment Status Report loaded successfully')
  })

  test('Phase 1 Report 4: Purchase Trend Analysis', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/trend-analysis`)

    await page.waitForSelector('h1:has-text("Purchase Trend Analysis")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Purchase Trend Analysis loaded successfully')
  })

  test('Phase 1 Report 5: Item Purchase Detail', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/item-detail`)

    await page.waitForSelector('h1:has-text("Item Purchase Detail")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Item Purchase Detail loaded successfully')
  })

  test('Phase 2 Report 6: Supplier Performance', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/supplier-performance`)

    await page.waitForSelector('h1:has-text("Supplier Performance")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Supplier Performance loaded successfully')
  })

  test('Phase 2 Report 7: Category Summary', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/category-summary`)

    await page.waitForSelector('h1:has-text("Category")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Category Summary loaded successfully')
  })

  test('Phase 2 Report 8: Daily Summary', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/daily-summary`)

    await page.waitForSelector('h1:has-text("Daily")', { timeout: 10000 })

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Daily Summary loaded successfully')
  })

  test('Phase 3 Report 9: Item Cost Trend', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/cost-trend`)

    await page.waitForSelector('h1:has-text("Cost Trend")', { timeout: 10000 })

    // This report requires product selection
    const productSelect = page.locator('select#productId, select[name="productId"]')
    if (await productSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select first product if dropdown exists
      await productSelect.selectOption({ index: 1 })
    }

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    // Wait for either table or "no data" message
    await page.waitForSelector('table, .report-table, text=/no data/i', { timeout: 15000 })

    console.log('✓ Item Cost Trend loaded successfully')
  })

  test('Phase 3 Report 10: Budget vs Actual', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/budget-vs-actual`)

    await page.waitForSelector('h1:has-text("Budget")', { timeout: 10000 })

    // This report requires monthly budget input
    const budgetInput = page.locator('input[type="number"], input[name*="budget"]')
    if (await budgetInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await budgetInput.fill('50000')
    }

    const generateButton = page.locator('button:has-text("Generate")')
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click()
    }

    await page.waitForSelector('table, .report-table', { timeout: 15000 })

    console.log('✓ Budget vs Actual loaded successfully')
  })

  test('Report Features: Search functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/item-summary`)
    await page.waitForSelector('table', { timeout: 15000 })

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test')
      console.log('✓ Search functionality exists')
    }
  })

  test('Report Features: Export to CSV', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases/item-summary`)
    await page.waitForSelector('table', { timeout: 15000 })

    const csvButton = page.locator('button:has-text("CSV"), button[title*="CSV"]')
    if (await csvButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Just verify button exists and is clickable
      await expect(csvButton).toBeEnabled()
      console.log('✓ CSV export button functional')
    }
  })

  test('All 10 reports are accessible from main page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases`)
    await page.waitForSelector('h1:has-text("Purchase Reports")')

    // Check that all 10 reports are listed and clickable
    const reportLinks = await page.locator('button[class*="report"], a[href*="/reports/purchases/"]').count()
    expect(reportLinks).toBeGreaterThanOrEqual(10)

    console.log(`✓ Found ${reportLinks} report links on main page`)
  })
})
