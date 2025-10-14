import { test, expect } from '@playwright/test'

test.describe('Inventory Ledger Report', () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**')
  })

  test('should generate inventory ledger report successfully', async ({ page }) => {
    // Navigate to inventory ledger report
    await page.goto('http://localhost:3000/dashboard/reports/inventory-ledger')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Inventory Transaction Ledger")')

    // Wait for data to load
    await page.waitForTimeout(2000)

    // Select location (Main Warehouse)
    await page.selectOption('select:near(:text("1. Location"))', { index: 1 })
    await page.waitForTimeout(500)

    // Select product
    await page.selectOption('select:near(:text("3. Product"))', { index: 1 })
    await page.waitForTimeout(500)

    // Select variation
    await page.selectOption('select:near(:text("4. Variation"))', { index: 1 })
    await page.waitForTimeout(500)

    // Click Generate Report button
    await page.click('button:has-text("Generate Report")')

    // Wait for the report to load or error
    await page.waitForTimeout(3000)

    // Check if error message appears
    const errorElement = await page.locator('text=Failed to generate inventory ledger').count()

    if (errorElement > 0) {
      // Get the error message
      const errorText = await page.locator('div:has-text("Failed to generate")').textContent()
      console.log('Error found:', errorText)

      // Take screenshot
      await page.screenshot({ path: 'inventory-ledger-error.png', fullPage: true })

      throw new Error(`Report generation failed: ${errorText}`)
    }

    // If no error, verify the report loaded
    const reportHeaderExists = await page.locator('text=Report Period').count()

    if (reportHeaderExists > 0) {
      console.log('✅ Report generated successfully!')
      await page.screenshot({ path: 'inventory-ledger-success.png', fullPage: true })

      // Verify key elements
      await expect(page.locator('text=Report Period')).toBeVisible()
      await expect(page.locator('text=Starting Balance')).toBeVisible()
      await expect(page.locator('text=Reconciliation Status')).toBeVisible()
    } else {
      await page.screenshot({ path: 'inventory-ledger-unknown.png', fullPage: true })
      throw new Error('Neither success nor error state detected')
    }
  })
})
