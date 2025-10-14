import { test, expect } from '@playwright/test'

test.describe('Inventory Corrections - Barcode Scanning', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    // Login as branch manager who has access to location 2
    await page.goto('http://localhost:3005/login')
    await page.fill('input[name="username"]', 'branchmanager')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Navigate to new inventory correction page
    await page.goto('http://localhost:3005/dashboard/inventory-corrections/new')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  })

  test('should scan barcode and auto-populate system count', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForSelector('input[placeholder*="Scan barcode"]', { timeout: 10000 })

    // Find the barcode search input
    const barcodeInput = page.locator('input[placeholder*="Scan barcode"]')

    // Enter SKU PCI-0002
    await barcodeInput.fill('PCI-0002')

    // Press Enter to trigger search
    await barcodeInput.press('Enter')

    // Wait for the API call to complete
    await page.waitForTimeout(2000)

    // Check if product was found (should show success toast)
    const successToast = page.locator('text=/Product found/i')
    await expect(successToast).toBeVisible({ timeout: 5000 })

    // Check if system count field is populated (should not be empty)
    const systemCountInput = page.locator('input#systemCount, input[readonly]').filter({ hasText: /^\d/ })

    // Get the system count value
    const systemCountValue = await systemCountInput.inputValue()
    console.log('System count value:', systemCountValue)

    // System count should be a number (not empty, not "—", not "N/A")
    expect(systemCountValue).toMatch(/^\d+\.?\d*$/)

    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/barcode-scan-success.png', fullPage: true })
  })

  test('should show detailed error if API fails', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Listen for API responses
    const apiResponses: any[] = []
    page.on('response', async response => {
      const url = response.url()
      if (url.includes('/api/products/variations')) {
        const status = response.status()
        let body = null
        try {
          body = await response.json()
        } catch (e) {
          body = await response.text()
        }
        apiResponses.push({ url, status, body })
      }
    })

    // Find the barcode search input
    const barcodeInput = page.locator('input[placeholder*="Scan barcode"]')

    // Enter SKU
    await barcodeInput.fill('PCI-0002')
    await barcodeInput.press('Enter')

    // Wait for API calls
    await page.waitForTimeout(3000)

    // Log all API responses
    console.log('\n=== API Responses ===')
    for (const resp of apiResponses) {
      console.log(`URL: ${resp.url}`)
      console.log(`Status: ${resp.status}`)
      console.log(`Body:`, JSON.stringify(resp.body, null, 2))
      console.log('---')
    }

    // Log console errors
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===')
      consoleErrors.forEach(err => console.log(err))
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/barcode-scan-debug.png', fullPage: true })
  })
})
