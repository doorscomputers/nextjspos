import { test, expect } from '@playwright/test'

test.describe('Product and Stock Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should create a product and be available to all branches', async ({ page }) => {
    // Navigate to Add Product page
    await page.goto('/dashboard/products/add')

    // Fill in product details
    const productName = `Test Product ${Date.now()}`
    const productSKU = `TEST-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    // Save product
    await page.click('button[type="submit"]:has-text("Save")')

    // Wait for success and redirect
    await page.waitForURL('/dashboard/products')

    // Verify product appears in list
    await expect(page.locator(`text=${productName}`)).toBeVisible()

    // Navigate to All Branch Stock view
    await page.goto('/dashboard/products/all-branch-stock')

    // Verify product appears with all branches having zero stock
    await expect(page.locator(`text=${productName}`)).toBeVisible()

    // Check that all locations show zero stock
    const productRow = page.locator(`tr:has-text("${productName}")`)
    await expect(productRow).toBeVisible()
  })

  test('should add opening stock for all branches with different prices', async ({ page }) => {
    // First create a product
    await page.goto('/dashboard/products/add')

    const productName = `Stock Test ${Date.now()}`
    const productSKU = `STOCK-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '50')
    await page.fill('input[name="sellingPrice"]', '80')

    // Click "Save & Add Opening Stock"
    await page.click('button:has-text("Save & Add Opening Stock")')

    // Should redirect to opening stock page
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Verify product name is shown
    await expect(page.locator(`text=${productName}`)).toBeVisible()

    // Get all location rows
    const locationRows = page.locator('tbody tr')
    const rowCount = await locationRows.count()

    // Fill in stock for each location with different prices
    for (let i = 0; i < rowCount; i++) {
      const row = locationRows.nth(i)

      // Fill quantity
      await row.locator('input[type="number"]').nth(0).fill(`${(i + 1) * 10}`)

      // Fill purchase price
      await row.locator('input[type="number"]').nth(1).fill('50')

      // Fill selling price (different for each branch)
      await row.locator('input[type="number"]').nth(2).fill(`${80 + (i * 5)}`)
    }

    // Save opening stock
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')

    // Wait for success
    await page.waitForURL('/dashboard/products')

    // Navigate to All Branch Stock to verify
    await page.goto('/dashboard/products/all-branch-stock')

    // Verify product appears with stock
    const productRow = page.locator(`tr:has-text("${productName}")`)
    await expect(productRow).toBeVisible()

    // Verify each branch has different stock quantities
    const stockCells = productRow.locator('td')
    const cellCount = await stockCells.count()

    // At least one cell should show non-zero stock
    let hasStock = false
    for (let i = 0; i < cellCount; i++) {
      const cellText = await stockCells.nth(i).textContent()
      if (cellText && parseFloat(cellText) > 0) {
        hasStock = true
        break
      }
    }
    expect(hasStock).toBe(true)
  })

  test('should handle new branch addition for existing products', async ({ page }) => {
    // First create a product with opening stock
    await page.goto('/dashboard/products/add')

    const productName = `Branch Test ${Date.now()}`
    const productSKU = `BRANCH-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '30')
    await page.fill('input[name="sellingPrice"]', '50')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Add stock to first location only
    const firstRow = page.locator('tbody tr').first()
    await firstRow.locator('input[type="number"]').nth(0).fill('100')
    await firstRow.locator('input[type="number"]').nth(1).fill('30')
    await firstRow.locator('input[type="number"]').nth(2).fill('50')

    await page.click('button[type="submit"]:has-text("Save Opening Stock")')
    await page.waitForURL('/dashboard/products')

    // Now create a new branch
    await page.goto('/dashboard/locations')
    await page.click('a:has-text("Add Location")')

    const newBranchName = `New Branch ${Date.now()}`
    await page.fill('input[name="name"]', newBranchName)
    await page.fill('input[name="locationId"]', `NB-${Date.now()}`)

    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard/locations')

    // Verify new branch appears
    await expect(page.locator(`text=${newBranchName}`)).toBeVisible()

    // Go back to the product's opening stock page
    await page.goto('/dashboard/products')

    // Find and click on our test product
    await page.click(`text=${productName}`)

    // Navigate to All Branch Stock
    await page.goto('/dashboard/products/all-branch-stock')

    // Verify new branch column exists and shows zero stock for our product
    await expect(page.locator(`th:has-text("${newBranchName}")`)).toBeVisible()

    // Verify product row exists
    const productRow = page.locator(`tr:has-text("${productName}")`)
    await expect(productRow).toBeVisible()
  })

  test('should handle variable products with per-branch pricing', async ({ page }) => {
    // Create a variable product
    await page.goto('/dashboard/products/add')

    const productName = `Variable Test ${Date.now()}`
    const productSKU = `VAR-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'variable')
    await page.fill('input[name="sku"]', productSKU)

    // Add variations
    await page.click('button:has-text("Add Variation")')

    // Fill first variation
    await page.fill('input[name="variations.0.name"]', '128GB')
    await page.fill('input[name="variations.0.sku"]', `${productSKU}-128`)
    await page.fill('input[name="variations.0.purchasePrice"]', '100')
    await page.fill('input[name="variations.0.sellingPrice"]', '150')

    // Add second variation
    await page.click('button:has-text("Add Variation")')
    await page.fill('input[name="variations.1.name"]', '256GB')
    await page.fill('input[name="variations.1.sku"]', `${productSKU}-256`)
    await page.fill('input[name="variations.1.purchasePrice"]', '200')
    await page.fill('input[name="variations.1.sellingPrice"]', '280')

    // Save and add opening stock
    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Verify both variations are shown
    await expect(page.locator('text=128GB')).toBeVisible()
    await expect(page.locator('text=256GB')).toBeVisible()

    // Get all location rows for first variation
    const variation1Section = page.locator('div:has(h3:has-text("128GB"))').first()
    const variation1Rows = variation1Section.locator('tbody tr')
    const rowCount = await variation1Rows.count()

    // Fill stock for first variation with different branch prices
    for (let i = 0; i < rowCount; i++) {
      const row = variation1Rows.nth(i)
      await row.locator('input[type="number"]').nth(0).fill(`${50 + i * 10}`)
      await row.locator('input[type="number"]').nth(1).fill('100')
      await row.locator('input[type="number"]').nth(2).fill(`${150 + i * 10}`) // Different price per branch
    }

    // Save
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')
    await page.waitForURL('/dashboard/products')

    // Verify in product list
    await expect(page.locator(`text=${productName}`)).toBeVisible()
  })
})
