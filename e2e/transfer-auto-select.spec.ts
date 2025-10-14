import { test, expect } from '@playwright/test'

test.describe('Transfer Creation - Auto Location Selection (Jheirone)', () => {

  test.beforeEach(async ({ page }) => {
    // Login as Jheirone (assigned to Warehouse)
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="username"]', 'Jheirone')
    await page.fill('input[name="password"]', 'newpass123')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 })
  })

  test('should auto-select From Location for regular user', async ({ page }) => {
    // Navigate to Create Transfer page
    await page.goto('http://localhost:3000/dashboard/transfers/create')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Create Stock Transfer")', { timeout: 10000 })

    // Wait for locations to load
    await page.waitForTimeout(3000)

    // Check that From Location has a value selected
    const fromLocationSelect = page.locator('label:has-text("From Location")').locator('..').locator('[role="combobox"]')
    await expect(fromLocationSelect).toBeVisible()

    // Get the text content of the selected value
    const selectedValue = await fromLocationSelect.textContent()
    console.log('From Location selected value:', selectedValue)

    // Should NOT be the placeholder text
    expect(selectedValue).not.toContain('Select origin location')

    // Should have "Main Warehouse" selected
    expect(selectedValue).toContain('Main Warehouse')
  })

  test('should disable From Location field for regular user', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/transfers/create')

    await page.waitForSelector('h1:has-text("Create Stock Transfer")', { timeout: 10000 })
    await page.waitForTimeout(3000)

    // Check that From Location is disabled
    const fromLocationButton = page.locator('label:has-text("From Location")').locator('..').locator('button[role="combobox"]')
    await expect(fromLocationButton).toBeDisabled()
  })

  test('should show helper text "Auto-assigned to your location"', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/transfers/create')

    await page.waitForSelector('h1:has-text("Create Stock Transfer")', { timeout: 10000 })
    await page.waitForTimeout(3000)

    // Check for helper text
    await expect(page.locator('text=Auto-assigned to your location')).toBeVisible()
  })

  test('should show ProductAutocomplete for barcode scanning', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/transfers/create')

    await page.waitForSelector('h1:has-text("Create Stock Transfer")', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Check that ProductAutocomplete input exists
    const searchInput = page.locator('input[placeholder*="Scan barcode"]')
    await expect(searchInput).toBeVisible()

    // Check placeholder text
    const placeholder = await searchInput.getAttribute('placeholder')
    expect(placeholder).toContain('barcode')
    expect(placeholder).toContain('SKU')
  })

  test('should NOT show old warning message', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/transfers/create')

    await page.waitForSelector('h1:has-text("Create Stock Transfer")', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Old warning should NOT exist
    await expect(page.locator('text=Please select "From Location" first to see available stock')).not.toBeVisible()
  })
})
