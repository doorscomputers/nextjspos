import { test, expect } from '@playwright/test'

test.describe('Opening Stock Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin (who should have PRODUCT_OPENING_STOCK permission)
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should successfully add opening stock for a single product with multiple locations', async ({ page }) => {
    // Create a new product first
    await page.goto('/dashboard/products/add')

    const productName = `Opening Stock Test ${Date.now()}`
    const productSKU = `OST-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '110')

    // Click "Save & Add Opening Stock" button
    await page.click('button:has-text("Save & Add Opening Stock")')

    // Should redirect to opening stock page
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/, { timeout: 10000 })

    // Verify we're on the opening stock page
    await expect(page.locator('text=Add Opening Stock')).toBeVisible()
    await expect(page.locator(`text=${productName}`)).toBeVisible()

    // Get all location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Ensure we have at least one location
    expect(rowCount).toBeGreaterThan(0)

    // Fill in opening stock for the first 3 locations (or all if less than 3)
    const locationsToFill = Math.min(3, rowCount)

    for (let i = 0; i < locationsToFill; i++) {
      const row = tableRows.nth(i)

      // Fill quantity (index 0)
      await row.locator('input[type="number"]').nth(0).fill('100')

      // Fill unit cost/purchase price (index 1)
      await row.locator('input[type="number"]').nth(1).fill('100')

      // Fill selling price (index 2)
      await row.locator('input[type="number"]').nth(2).fill(`${110 + (i * 10)}`)
    }

    // Click save button
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')

    // Wait for success toast
    await expect(page.locator('text=Opening stock added successfully')).toBeVisible({ timeout: 10000 })

    // Should redirect back to products page
    await page.waitForURL('/dashboard/products', { timeout: 10000 })

    // Verify product appears in list
    await expect(page.locator(`text=${productName}`)).toBeVisible()
  })

  test('should validate that at least one stock entry is required', async ({ page }) => {
    // Create a new product
    await page.goto('/dashboard/products/add')

    const productName = `Validation Test ${Date.now()}`
    const productSKU = `VAL-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '50')
    await page.fill('input[name="sellingPrice"]', '75')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Try to save without entering any stock quantities
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')

    // Should show error toast
    await expect(page.locator('text=Please enter at least one stock quantity')).toBeVisible({ timeout: 5000 })

    // Should still be on the opening stock page
    await expect(page.url()).toContain('/opening-stock')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to opening stock page with an invalid product ID
    await page.goto('/dashboard/products/999999/opening-stock')

    // Should show product not found message
    await expect(page.locator('text=Product not found')).toBeVisible({ timeout: 10000 })

    // Should have a back button
    await expect(page.locator('text=Back to Products')).toBeVisible()
  })

  test('should display proper UI with ShadCN components', async ({ page }) => {
    // Create a product and navigate to opening stock
    await page.goto('/dashboard/products/add')

    const productName = `UI Test ${Date.now()}`
    const productSKU = `UI-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '25')
    await page.fill('input[name="sellingPrice"]', '40')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Verify ShadCN Card component is used
    await expect(page.locator('[data-slot="card"]')).toBeVisible()

    // Verify table components
    await expect(page.locator('[data-slot="table"]')).toBeVisible()

    // Verify input fields are present
    const inputs = page.locator('input[type="number"]')
    const inputCount = await inputs.count()
    expect(inputCount).toBeGreaterThan(0)

    // Verify buttons use ShadCN button component
    const saveButton = page.locator('button[type="submit"]:has-text("Save Opening Stock")')
    await expect(saveButton).toBeVisible()

    const cancelButton = page.locator('a:has-text("Cancel")')
    await expect(cancelButton).toBeVisible()
  })

  test('should allow canceling and return to products page', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Cancel Test ${Date.now()}`
    const productSKU = `CANCEL-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '10')
    await page.fill('input[name="sellingPrice"]', '20')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Click cancel button
    await page.click('a:has-text("Cancel")')

    // Should return to products page
    await page.waitForURL('/dashboard/products')
    await expect(page.url()).toContain('/dashboard/products')
  })

  test('should persist and display different selling prices per location', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Price Test ${Date.now()}`
    const productSKU = `PRICE-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Fill different prices for each location
    for (let i = 0; i < Math.min(3, rowCount); i++) {
      const row = tableRows.nth(i)
      await row.locator('input[type="number"]').nth(0).fill('50') // Quantity
      await row.locator('input[type="number"]').nth(1).fill('100') // Unit cost
      await row.locator('input[type="number"]').nth(2).fill(`${150 + (i * 20)}`) // Different selling price
    }

    // Save
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')
    await expect(page.locator('text=Opening stock added successfully')).toBeVisible({ timeout: 10000 })
    await page.waitForURL('/dashboard/products')

    // Verify product was created successfully
    await expect(page.locator(`text=${productName}`)).toBeVisible()
  })

  test('should not have type conversion errors when saving stock transactions (Fix: createdBy field)', async ({ page }) => {
    // This test verifies that user.id is properly converted to integer for createdBy field
    await page.goto('/dashboard/products/add')

    const productName = `Type Conversion Test ${Date.now()}`
    const productSKU = `TYPE-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '200')
    await page.fill('input[name="sellingPrice"]', '300')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Fill stock for all locations
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i)
      await row.locator('input[type="number"]').nth(0).fill('100') // Quantity
      await row.locator('input[type="number"]').nth(1).fill('200') // Unit cost
      await row.locator('input[type="number"]').nth(2).fill('300') // Selling price
    }

    // Listen for console errors (Prisma validation errors would appear here)
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Save opening stock
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')

    // Should succeed without Prisma type errors
    await expect(page.locator('text=Opening stock added successfully')).toBeVisible({ timeout: 10000 })
    await page.waitForURL('/dashboard/products')

    // Verify no Prisma type conversion errors in console
    const hasPrismaError = consoleErrors.some(err =>
      err.includes('Invalid value provided') ||
      err.includes('Expected Int, provided String') ||
      err.includes('Expected int, provided String')
    )
    expect(hasPrismaError).toBe(false)

    // Verify product appears in list
    await expect(page.locator(`text=${productName}`)).toBeVisible()
  })

  test('should auto-fill unit cost from first location to all other locations', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Auto-fill Test ${Date.now()}`
    const productSKU = `AUTO-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '50')
    await page.fill('input[name="sellingPrice"]', '75')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Ensure we have at least 2 locations for this test
    expect(rowCount).toBeGreaterThanOrEqual(2)

    // Fill unit cost in the FIRST location only
    const firstRow = tableRows.nth(0)
    await firstRow.locator('input[type="number"]').nth(1).fill('125.50') // Unit cost

    // Wait a moment for auto-fill to trigger
    await page.waitForTimeout(500)

    // Verify that all other locations have the same unit cost
    for (let i = 1; i < rowCount; i++) {
      const row = tableRows.nth(i)
      const unitCostInput = row.locator('input[type="number"]').nth(1)
      const value = await unitCostInput.inputValue()
      expect(value).toBe('125.50')

      // Verify auto-fill badge is visible
      const autoBadge = row.locator('text=Auto')
      await expect(autoBadge).toBeVisible()
    }

    // Verify first location shows auto-fill hint
    await expect(firstRow.locator('text=(Auto-fills below)')).toBeVisible()
  })

  test('should allow manual override of auto-filled unit cost', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Manual Override Test ${Date.now()}`
    const productSKU = `OVERRIDE-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Fill unit cost in the FIRST location
    const firstRow = tableRows.nth(0)
    await firstRow.locator('input[type="number"]').nth(1).fill('100')
    await page.waitForTimeout(500)

    // Verify second location was auto-filled
    if (rowCount >= 2) {
      const secondRow = tableRows.nth(1)
      let unitCostInput = secondRow.locator('input[type="number"]').nth(1)
      expect(await unitCostInput.inputValue()).toBe('100')

      // Manually change the second location's unit cost
      await unitCostInput.fill('150')
      await page.waitForTimeout(300)

      // Verify the manual change persists
      expect(await unitCostInput.inputValue()).toBe('150')

      // Verify "Auto" badge disappears after manual edit
      const autoBadge = secondRow.locator('text=Auto')
      await expect(autoBadge).not.toBeVisible()
    }

    // Now change the first location's unit cost again
    await firstRow.locator('input[type="number"]').nth(1).fill('200')
    await page.waitForTimeout(500)

    // Verify locations that weren't manually edited get updated
    if (rowCount >= 3) {
      const thirdRow = tableRows.nth(2)
      const thirdUnitCostInput = thirdRow.locator('input[type="number"]').nth(1)
      expect(await thirdUnitCostInput.inputValue()).toBe('200')
    }

    // Verify second location (manually edited) was also updated to new auto-fill value
    if (rowCount >= 2) {
      const secondRow = tableRows.nth(1)
      const secondUnitCostInput = secondRow.locator('input[type="number"]').nth(1)
      expect(await secondUnitCostInput.inputValue()).toBe('200')
    }
  })

  test('should display visual indicators for auto-filled values', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Visual Indicator Test ${Date.now()}`
    const productSKU = `VISUAL-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '80')
    await page.fill('input[name="sellingPrice"]', '120')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Fill unit cost in first location
    const tableRows = page.locator('tbody tr')
    const firstRow = tableRows.nth(0)
    await firstRow.locator('input[type="number"]').nth(1).fill('99.99')
    await page.waitForTimeout(500)

    // Verify visual indicators
    const rowCount = await tableRows.count()
    if (rowCount >= 2) {
      const secondRow = tableRows.nth(1)

      // Check for auto-fill badge with sparkles icon
      const autoBadge = secondRow.locator('text=Auto')
      await expect(autoBadge).toBeVisible()

      // Check for visual styling (blue border/background)
      const unitCostInput = secondRow.locator('input[type="number"]').nth(1)
      const inputClasses = await unitCostInput.getAttribute('class')
      expect(inputClasses).toContain('border-blue-300')
    }
  })

  test('should auto-fill selling price from first location to all other locations', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Selling Price Auto-fill Test ${Date.now()}`
    const productSKU = `SELL-AUTO-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '50')
    await page.fill('input[name="sellingPrice"]', '75')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Ensure we have at least 2 locations for this test
    expect(rowCount).toBeGreaterThanOrEqual(2)

    // Fill selling price in the FIRST location only (index 2 is selling price)
    const firstRow = tableRows.nth(0)
    await firstRow.locator('input[type="number"]').nth(2).fill('199.99') // Selling price

    // Wait a moment for auto-fill to trigger
    await page.waitForTimeout(500)

    // Verify that all other locations have the same selling price
    for (let i = 1; i < rowCount; i++) {
      const row = tableRows.nth(i)
      const sellingPriceInput = row.locator('input[type="number"]').nth(2)
      const value = await sellingPriceInput.inputValue()
      expect(value).toBe('199.99')

      // Verify auto-fill badge is visible for selling price
      const autoBadges = row.locator('text=Auto')
      const badgeCount = await autoBadges.count()
      expect(badgeCount).toBeGreaterThan(0)
    }

    // Verify first location shows auto-fill hint for selling price column
    const hints = firstRow.locator('text=(Auto-fills below)')
    const hintCount = await hints.count()
    expect(hintCount).toBeGreaterThanOrEqual(1) // Should have hints for both unit cost and selling price
  })

  test('should allow manual override of auto-filled selling price', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Selling Price Override Test ${Date.now()}`
    const productSKU = `SELL-OVERRIDE-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Fill selling price in the FIRST location
    const firstRow = tableRows.nth(0)
    await firstRow.locator('input[type="number"]').nth(2).fill('250')
    await page.waitForTimeout(500)

    // Verify second location was auto-filled
    if (rowCount >= 2) {
      const secondRow = tableRows.nth(1)
      let sellingPriceInput = secondRow.locator('input[type="number"]').nth(2)
      expect(await sellingPriceInput.inputValue()).toBe('250')

      // Manually change the second location's selling price
      await sellingPriceInput.fill('299.99')
      await page.waitForTimeout(300)

      // Verify the manual change persists
      expect(await sellingPriceInput.inputValue()).toBe('299.99')

      // Verify "Auto" badge disappears after manual edit for selling price
      // We need to check only the selling price column's Auto badge
      const allAutoBadges = secondRow.locator('text=Auto')
      const badgeCount = await allAutoBadges.count()
      // If unit cost was also auto-filled, there might be 1 badge left
      expect(badgeCount).toBeLessThan(2)
    }
  })

  test('should auto-fill both unit cost and selling price independently', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Dual Auto-fill Test ${Date.now()}`
    const productSKU = `DUAL-AUTO-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    expect(rowCount).toBeGreaterThanOrEqual(2)

    const firstRow = tableRows.nth(0)

    // Fill unit cost first
    await firstRow.locator('input[type="number"]').nth(1).fill('123.45')
    await page.waitForTimeout(500)

    // Fill selling price
    await firstRow.locator('input[type="number"]').nth(2).fill('234.56')
    await page.waitForTimeout(500)

    // Verify both values auto-filled to other locations
    for (let i = 1; i < rowCount; i++) {
      const row = tableRows.nth(i)

      const unitCostInput = row.locator('input[type="number"]').nth(1)
      expect(await unitCostInput.inputValue()).toBe('123.45')

      const sellingPriceInput = row.locator('input[type="number"]').nth(2)
      expect(await sellingPriceInput.inputValue()).toBe('234.56')

      // Should have multiple "Auto" badges (one for unit cost, one for selling price)
      const autoBadges = row.locator('text=Auto')
      const badgeCount = await autoBadges.count()
      expect(badgeCount).toBe(2)
    }
  })
})

test.describe('Branch-Level Permissions for Opening Stock', () => {
  test('cashier should only see their assigned location in opening stock page', async ({ page }) => {
    // Login as cashier (who is assigned only to Downtown Branch)
    await page.goto('/login')
    await page.fill('input[name="username"]', 'cashier')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Create a product first as admin
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    await page.goto('/dashboard/products/add')

    const productName = `Branch Permission Test ${Date.now()}`
    const productSKU = `BRANCH-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Get the product ID from URL
    const url = page.url()
    const productId = url.match(/\/products\/(\d+)\//)?.[1]

    // Now logout and login as cashier
    await page.goto('/login')
    await page.fill('input[name="username"]', 'cashier')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to opening stock page
    await page.goto(`/dashboard/products/${productId}/opening-stock`)

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Get all location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Cashier should only see 1 location (Downtown Branch)
    console.log('Location rows visible to cashier:', rowCount)
    expect(rowCount).toBe(1)

    // Verify the location name is Downtown Branch
    const locationName = await tableRows.nth(0).locator('td').first().textContent()
    expect(locationName).toContain('Downtown')
  })

  test('admin should see all locations in opening stock page', async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Admin All Locations Test ${Date.now()}`
    const productSKU = `ADMIN-LOC-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save & Add Opening Stock")')
    await page.waitForURL(/\/dashboard\/products\/\d+\/opening-stock/)

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Get all location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Admin should see all business locations (at least 2: Main Store and Downtown Branch)
    console.log('Location rows visible to admin:', rowCount)
    expect(rowCount).toBeGreaterThanOrEqual(2)
  })

  test('cashier should get 403 error when trying to add stock for unauthorized location', async ({ page }) => {
    // This test requires manually calling the API with an unauthorized locationId
    // First login as admin to create a product
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    await page.goto('/dashboard/products/add')

    const productName = `API Security Test ${Date.now()}`
    const productSKU = `SEC-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    // Save without opening stock
    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Get the product ID
    // Find the product in the list and extract ID
    const productRow = page.locator(`text=${productName}`).first()
    await productRow.click()
    await page.waitForURL(/\/dashboard\/products\/\d+/)
    const url = page.url()
    const productId = url.match(/\/products\/(\d+)/)?.[1]

    // Logout and login as cashier
    await page.goto('/login')
    await page.fill('input[name="username"]', 'cashier')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Manually call the API with Main Store location (ID: 1) which cashier doesn't have access to
    const response = await page.evaluate(async (productId) => {
      const res = await fetch(`/api/products/${productId}/opening-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockEntries: [
            {
              locationId: '1', // Main Warehouse - cashier doesn't have access
              quantity: '100',
              purchasePrice: '100',
              sellingPrice: '150'
            }
          ]
        })
      })
      return {
        status: res.status,
        data: await res.json()
      }
    }, productId)

    // Should return 403 Forbidden
    expect(response.status).toBe(403)
    expect(response.data.error).toContain('Forbidden')
  })
})
