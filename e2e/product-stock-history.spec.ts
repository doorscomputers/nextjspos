import { test, expect } from '@playwright/test'

test.describe('Product Stock History - Critical E2E Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
  })

  test('should create opening stock transactions and display in stock history', async ({ page }) => {
    const timestamp = Date.now()
    const productName = `E2E Test Product ${timestamp}`

    console.log(`Creating product: ${productName}`)

    // Step 1: Navigate to products page
    await page.goto('/dashboard/products')
    await page.waitForLoadState('networkidle')

    // Step 2: Click "Add Product" button
    const addButton = page.getByRole('link', { name: 'Add Product' }).or(page.getByRole('button', { name: 'Add Product' }))
    await addButton.click()
    await page.waitForURL('**/products/add**', { timeout: 10000 })

    // Step 3: Fill in product details
    await page.fill('input[name="name"]', productName)

    // Select single product type
    const typeSelect = page.locator('select').filter({ hasText: 'single' }).or(page.locator('select[name="type"]'))
    await typeSelect.selectOption('single')

    // Fill in purchase and selling prices
    await page.fill('input[name="purchasePrice"]', '50.00')
    await page.fill('input[name="sellingPrice"]', '75.00')

    // Step 4: Click "Save and Add Opening Stock" button
    const saveAndStockButton = page.getByRole('button', { name: /save.*add.*opening.*stock/i })
    await saveAndStockButton.click()

    // Wait for opening stock page
    await page.waitForURL('**/opening-stock**', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    console.log('Filling opening stock...')

    // Step 5: Fill in opening stock for the first location
    // Find all quantity input fields and fill the first one
    const quantityInput = page.locator('input[type="number"]').filter({ hasText: '' }).first()
    await quantityInput.fill('100')

    // Fill in unit cost (purchase price)
    const unitCostInputs = page.locator('input[type="number"][step="0.01"]')
    const secondInput = unitCostInputs.nth(1)
    await secondInput.fill('50.00')

    // Step 6: Save opening stock
    const saveButton = page.getByRole('button', { name: /save.*opening.*stock/i })
    await saveButton.click()

    // Wait for redirect to products page
    await page.waitForURL('**/dashboard/products**', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    console.log('Product and opening stock created, now verifying...')

    // Step 7: Find the product we just created and click on it
    const productLink = page.getByText(productName, { exact: false }).first()
    await productLink.click()

    // Wait for product details page
    await page.waitForURL('**/dashboard/products/**/view', { timeout: 10000 })
      .catch(() => page.waitForURL('**/dashboard/products/**', { timeout: 10000 }))

    // Step 8: Navigate to stock history
    const stockHistoryLink = page.getByRole('link', { name: /stock.*history/i })
      .or(page.getByText(/stock.*history/i))
    await stockHistoryLink.click()

    // Wait for stock history page to load
    await page.waitForURL('**/stock-history**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Wait a bit for data to load
    await page.waitForTimeout(3000)

    console.log('Stock history page loaded, checking for transaction...')

    // Step 9: Verify stock history table is visible
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    // Step 10: Check for "Opening Stock" badge/transaction
    const openingStockBadge = page.getByText('Opening Stock', { exact: false }).first()
    await expect(openingStockBadge).toBeVisible({ timeout: 5000 })

    // Step 11: Verify the quantity shows +100.00 in green
    const positiveQuantity = page.locator('span.text-green-600').filter({ hasText: '+100' })
    await expect(positiveQuantity).toBeVisible()

    // Step 12: Verify summary section
    // Check "Quantities In" section
    const quantitiesInSection = page.locator('h3:has-text("Quantities In")').locator('..')
    const openingStockValue = quantitiesInSection.locator('text=Opening Stock').locator('..').locator('span').last()
    await expect(openingStockValue).toHaveText('100.00', { timeout: 5000 })

    // Check current stock in "Totals" section
    const totalsSection = page.locator('h3:has-text("Totals")').locator('..')
    const currentStockValue = totalsSection.locator('text=Current stock').locator('..').locator('span').last()
    await expect(currentStockValue).toHaveText('100.00', { timeout: 5000 })

    console.log('✓ All verifications passed!')
  })
})
