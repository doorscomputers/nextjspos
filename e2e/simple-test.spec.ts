import { test, expect } from '@playwright/test'

test.describe('Basic Functionality Test', () => {
  test('should login and access dashboard', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for dashboard with increased timeout
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('should create a single product', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Navigate to Add Product
    await page.goto('/dashboard/products/add')
    await page.waitForLoadState('networkidle')

    // Wait for page to load
    await page.waitForSelector('input[placeholder="Enter product name"]', { timeout: 15000 })

    // Fill product details
    const productName = `Test Product ${Date.now()}`
    const productSKU = `TEST-${Date.now()}`

    await page.fill('input[placeholder="Enter product name"]', productName)
    await page.fill('input[placeholder="Leave empty to auto-generate"]', productSKU)

    // Scroll to pricing section
    await page.locator('text=Pricing').scrollIntoViewIfNeeded()
    await page.fill('input[placeholder="Purchase price exc. tax"]', '100')
    await page.fill('input[placeholder="Selling price exc. tax"]', '150')

    // Submit
    await page.click('button[type="submit"]:has-text("Save")')

    // Wait for redirect
    await page.waitForURL('/dashboard/products', { timeout: 15000 })

    // Verify product was created
    await expect(page.locator(`text=${productName}`)).toBeVisible({ timeout: 10000 })
  })

  test('should add opening stock', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Create product
    await page.goto('/dashboard/products/add')
    await page.waitForLoadState('networkidle')

    // Wait for page to load
    await page.waitForSelector('input[placeholder="Enter product name"]', { timeout: 15000 })

    const productName = `Stock Test ${Date.now()}`
    const productSKU = `STOCK-${Date.now()}`

    await page.fill('input[placeholder="Enter product name"]', productName)
    await page.fill('input[placeholder="Leave empty to auto-generate"]', productSKU)

    // Scroll to pricing section
    await page.locator('text=Pricing').scrollIntoViewIfNeeded()
    await page.fill('input[placeholder="Purchase price exc. tax"]', '50')
    await page.fill('input[placeholder="Selling price exc. tax"]', '80')

    // Click Save & Add Opening Stock
    await page.click('button:has-text("Save & Add Opening Stock")')

    // Wait for opening stock page
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/, { timeout: 15000 })

    // Verify product name shown
    await expect(page.locator(`text=${productName}`)).toBeVisible()

    // Fill first location stock
    const firstQuantityInput = page.locator('tbody tr').first().locator('input[type="number"]').first()
    await firstQuantityInput.fill('100')

    const firstPurchasePriceInput = page.locator('tbody tr').first().locator('input[type="number"]').nth(1)
    await firstPurchasePriceInput.fill('50')

    const firstSellingPriceInput = page.locator('tbody tr').first().locator('input[type="number"]').nth(2)
    await firstSellingPriceInput.fill('80')

    // Save opening stock
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')
    await page.waitForURL('/dashboard/products', { timeout: 15000 })
  })
})
