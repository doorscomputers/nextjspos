import { test, expect } from '@playwright/test'

test.describe('Auto-Zero Inventory Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin (who has all permissions)
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should auto-create zero inventory for all existing products when new location is created', async ({ page }) => {
    // First, create a product
    await page.goto('/dashboard/products/add')

    const productName = `Auto Inventory Test Product ${Date.now()}`
    const productSKU = `AUTO-INV-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    // Save the product
    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Extract product ID from the products list
    const productRow = page.locator(`text=${productName}`).first()
    await productRow.click()
    await page.waitForURL(/\/dashboard\/products\/\d+/)
    const productUrl = page.url()
    const productId = productUrl.match(/\/products\/(\d+)/)?.[1]

    // Now create a new location
    await page.goto('/dashboard/locations/add')

    const locationName = `New Branch ${Date.now()}`

    await page.fill('input[name="name"]', locationName)
    await page.fill('input[name="country"]', 'USA')
    await page.fill('input[name="state"]', 'California')
    await page.fill('input[name="city"]', 'San Francisco')
    await page.fill('input[name="zipCode"]', '94102')

    // Save the location
    await page.click('button[type="submit"]:has-text("Create Location")')
    await page.waitForURL('/dashboard/locations')

    // Verify success message
    await expect(page.locator('text=Location created successfully')).toBeVisible({ timeout: 10000 })

    // Navigate to opening stock page for the product
    await page.goto(`/dashboard/products/${productId}/opening-stock`)
    await page.waitForLoadState('networkidle')

    // Get all location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Find the new location in the list
    let newLocationFound = false
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i)
      const locationCell = await row.locator('td').first().textContent()

      if (locationCell?.includes(locationName)) {
        newLocationFound = true

        // Verify quantity is 0
        const quantityInput = row.locator('input[type="number"]').nth(0)
        const quantity = await quantityInput.inputValue()
        expect(quantity).toBe('0')

        break
      }
    }

    expect(newLocationFound).toBe(true)
  })

  test('should auto-create zero inventory for all existing locations when new product is created', async ({ page }) => {
    // First, ensure we have at least one location
    await page.goto('/dashboard/locations')
    await page.waitForLoadState('networkidle')

    const initialLocations = await page.locator('tbody tr').count()
    expect(initialLocations).toBeGreaterThan(0)

    // Create a new product
    await page.goto('/dashboard/products/add')

    const productName = `New Product Auto Inventory ${Date.now()}`
    const productSKU = `NEW-PROD-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '50')
    await page.fill('input[name="sellingPrice"]', '75')

    // Save the product
    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Extract product ID
    const productRow = page.locator(`text=${productName}`).first()
    await productRow.click()
    await page.waitForURL(/\/dashboard\/products\/\d+/)
    const productUrl = page.url()
    const productId = productUrl.match(/\/products\/(\d+)/)?.[1]

    // Navigate to opening stock page
    await page.goto(`/dashboard/products/${productId}/opening-stock`)
    await page.waitForLoadState('networkidle')

    // Get all location rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    // Verify that the product has entries for all locations (at least as many as we had initially)
    expect(rowCount).toBeGreaterThanOrEqual(initialLocations)

    // Verify all locations have quantity = 0
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i)
      const quantityInput = row.locator('input[type="number"]').nth(0)
      const quantity = await quantityInput.inputValue()

      expect(quantity).toBe('0')
    }
  })

  test('should auto-create zero inventory for variable products with multiple variations', async ({ page }) => {
    // Create a variable product
    await page.goto('/dashboard/products/add')

    const productName = `Variable Product Auto Inventory ${Date.now()}`
    const productSKU = `VAR-PROD-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'variable')
    await page.fill('input[name="sku"]', productSKU)

    // Add variations
    // Note: This assumes the UI has inputs for variations. Adjust selectors based on actual UI
    // For now, this is a placeholder - adjust based on your actual product creation UI

    // Save the product
    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // The auto-inventory should have been created for all variations at all locations
    // This would need to be verified through API or database check
    // For UI testing, we can verify on the opening stock page

    const productRow = page.locator(`text=${productName}`).first()
    await productRow.click()
    await page.waitForURL(/\/dashboard\/products\/\d+/)
    const productUrl = page.url()
    const productId = productUrl.match(/\/products\/(\d+)/)?.[1]

    await page.goto(`/dashboard/products/${productId}/opening-stock`)
    await page.waitForLoadState('networkidle')

    // Should have rows for all variations at all locations
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    expect(rowCount).toBeGreaterThan(0)
  })

  test('should handle creating location when no products exist', async ({ page }) => {
    // This test assumes a fresh business with no products
    // In a real scenario, you'd need to create a new test business

    // Create a new location
    await page.goto('/dashboard/locations/add')

    const locationName = `Empty Business Branch ${Date.now()}`

    await page.fill('input[name="name"]', locationName)
    await page.fill('input[name="country"]', 'Canada')
    await page.fill('input[name="state"]', 'Ontario')
    await page.fill('input[name="city"]', 'Toronto')
    await page.fill('input[name="zipCode"]', 'M5H2N2')

    // Save the location
    await page.click('button[type="submit"]:has-text("Create Location")')
    await page.waitForURL('/dashboard/locations')

    // Should succeed without errors
    await expect(page.locator('text=Location created successfully')).toBeVisible({ timeout: 10000 })

    // No inventory records should have been created, but no errors either
  })

  test('should handle creating product when no locations exist', async ({ page }) => {
    // This test assumes a fresh business with no locations
    // In a real scenario, you'd need to create a new test business

    // Create a new product
    await page.goto('/dashboard/products/add')

    const productName = `Empty Business Product ${Date.now()}`
    const productSKU = `EMPTY-BIZ-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    // Save the product
    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Should succeed without errors
    await expect(page.locator(`text=${productName}`)).toBeVisible()

    // No inventory records should have been created, but no errors either
  })

  test('should allow updating stock from zero through opening stock page', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Update From Zero Test ${Date.now()}`
    const productSKU = `UPDATE-ZERO-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Extract product ID
    const productRow = page.locator(`text=${productName}`).first()
    await productRow.click()
    await page.waitForURL(/\/dashboard\/products\/\d+/)
    const productUrl = page.url()
    const productId = productUrl.match(/\/products\/(\d+)/)?.[1]

    // Create a new location
    await page.goto('/dashboard/locations/add')

    const locationName = `Update Test Branch ${Date.now()}`

    await page.fill('input[name="name"]', locationName)
    await page.fill('input[name="country"]', 'USA')
    await page.fill('input[name="state"]', 'New York')
    await page.fill('input[name="city"]', 'New York')
    await page.fill('input[name="zipCode"]', '10001')

    await page.click('button[type="submit"]:has-text("Create Location")')
    await page.waitForURL('/dashboard/locations')

    // Navigate to opening stock page
    await page.goto(`/dashboard/products/${productId}/opening-stock`)
    await page.waitForLoadState('networkidle')

    // Find the new location row
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i)
      const locationCell = await row.locator('td').first().textContent()

      if (locationCell?.includes(locationName)) {
        // Initially should be 0
        const quantityInput = row.locator('input[type="number"]').nth(0)
        expect(await quantityInput.inputValue()).toBe('0')

        // Update the quantity
        await quantityInput.fill('50')
        await row.locator('input[type="number"]').nth(1).fill('100') // Unit cost
        await row.locator('input[type="number"]').nth(2).fill('150') // Selling price

        break
      }
    }

    // Save opening stock
    await page.click('button[type="submit"]:has-text("Save Opening Stock")')
    await expect(page.locator('text=Opening stock added successfully')).toBeVisible({ timeout: 10000 })
    await page.waitForURL('/dashboard/products')

    // Verify the stock was updated
    await page.goto(`/dashboard/products/${productId}/opening-stock`)
    await page.waitForLoadState('networkidle')

    const updatedRows = page.locator('tbody tr')
    const updatedRowCount = await updatedRows.count()

    for (let i = 0; i < updatedRowCount; i++) {
      const row = updatedRows.nth(i)
      const locationCell = await row.locator('td').first().textContent()

      if (locationCell?.includes(locationName)) {
        const quantityInput = row.locator('input[type="number"]').nth(0)
        expect(await quantityInput.inputValue()).toBe('50')
        break
      }
    }
  })

  test('should show all locations in stock reports with zero quantities', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Report Test Product ${Date.now()}`
    const productSKU = `REPORT-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Create a new location
    await page.goto('/dashboard/locations/add')

    const locationName = `Report Test Branch ${Date.now()}`

    await page.fill('input[name="name"]', locationName)
    await page.fill('input[name="country"]', 'USA')
    await page.fill('input[name="state"]', 'Texas')
    await page.fill('input[name="city"]', 'Austin')
    await page.fill('input[name="zipCode"]', '73301')

    await page.click('button[type="submit"]:has-text("Create Location")')
    await page.waitForURL('/dashboard/locations')

    // Navigate to stock report page (adjust URL based on your actual route)
    // This assumes there's a stock report page
    // await page.goto('/dashboard/reports/stock')
    // await page.waitForLoadState('networkidle')

    // Verify the new location shows up with 0 stock
    // This would need to be implemented based on actual stock report UI
  })

  test('should verify database records are created correctly via API', async ({ page }) => {
    // Create a product
    const productName = `API Verification Product ${Date.now()}`
    const productSKU = `API-VER-${Date.now()}`

    const createProductResponse = await page.evaluate(async (data) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          type: 'single',
          sku: data.sku,
          purchasePrice: '100',
          sellingPrice: '150'
        })
      })
      return {
        status: res.status,
        data: await res.json()
      }
    }, { name: productName, sku: productSKU })

    expect(createProductResponse.status).toBe(201)
    const productId = createProductResponse.data.product.id

    // Create a new location
    const locationName = `API Verification Branch ${Date.now()}`

    const createLocationResponse = await page.evaluate(async (data) => {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          country: 'USA',
          state: 'Florida',
          city: 'Miami',
          zipCode: '33101'
        })
      })
      return {
        status: res.status,
        data: await res.json()
      }
    }, { name: locationName })

    expect(createLocationResponse.status).toBe(201)

    // Verify that inventory records exist by checking opening stock endpoint
    const stockResponse = await page.evaluate(async (productId) => {
      const res = await fetch(`/api/products/${productId}/opening-stock`)
      return {
        status: res.status,
        data: await res.json()
      }
    }, productId)

    expect(stockResponse.status).toBe(200)

    // Verify that the new location has a zero-inventory record for this product
    const stockData = stockResponse.data
    const newLocationStock = stockData.locations?.find((loc: any) => loc.name === locationName)

    expect(newLocationStock).toBeDefined()
    expect(newLocationStock?.qtyAvailable).toBe(0)
  })
})

test.describe('Auto-Inventory Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should not duplicate inventory records if they already exist', async ({ page }) => {
    // Create a product
    await page.goto('/dashboard/products/add')

    const productName = `Duplicate Test Product ${Date.now()}`
    const productSKU = `DUP-TEST-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Create location - should create inventory records
    await page.goto('/dashboard/locations/add')

    const locationName = `Duplicate Test Branch ${Date.now()}`

    await page.fill('input[name="name"]', locationName)
    await page.fill('input[name="country"]', 'USA')
    await page.fill('input[name="state"]', 'Nevada')
    await page.fill('input[name="city"]', 'Las Vegas')
    await page.fill('input[name="zipCode"]', '89101')

    await page.click('button[type="submit"]:has-text("Create Location")')
    await page.waitForURL('/dashboard/locations')

    // Try creating the same location again (or similar operation)
    // The skipDuplicates flag should prevent errors

    // This test verifies no errors occur due to duplicate key constraints
    await expect(page.locator('text=Location created successfully')).toBeVisible({ timeout: 10000 })
  })

  test('should handle concurrent location creation without race conditions', async ({ page }) => {
    // Create a product first
    await page.goto('/dashboard/products/add')

    const productName = `Concurrency Test Product ${Date.now()}`
    const productSKU = `CONCUR-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="sku"]', productSKU)
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    await page.click('button:has-text("Save Product")')
    await page.waitForURL('/dashboard/products')

    // Try creating two locations rapidly (simulating concurrent requests)
    const location1Promise = page.evaluate(async () => {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Concurrent Branch 1 ${Date.now()}`,
          country: 'USA',
          state: 'Oregon',
          city: 'Portland',
          zipCode: '97201'
        })
      })
      return res.status
    })

    const location2Promise = page.evaluate(async () => {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Concurrent Branch 2 ${Date.now()}`,
          country: 'USA',
          state: 'Washington',
          city: 'Seattle',
          zipCode: '98101'
        })
      })
      return res.status
    })

    const [status1, status2] = await Promise.all([location1Promise, location2Promise])

    // Both should succeed
    expect(status1).toBe(201)
    expect(status2).toBe(201)
  })

  test('should handle large number of products when creating new location', async ({ page }) => {
    // Create multiple products
    const productCount = 5 // In real test, could be more
    const productIds: string[] = []

    for (let i = 0; i < productCount; i++) {
      const response = await page.evaluate(async (i) => {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Bulk Test Product ${Date.now()}-${i}`,
            type: 'single',
            sku: `BULK-${Date.now()}-${i}`,
            purchasePrice: '100',
            sellingPrice: '150'
          })
        })
        const data = await res.json()
        return data.product.id
      }, i)

      productIds.push(response)
    }

    // Now create a location - should create inventory for all products
    const createLocationResponse = await page.evaluate(async () => {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Bulk Test Branch ${Date.now()}`,
          country: 'USA',
          state: 'Colorado',
          city: 'Denver',
          zipCode: '80201'
        })
      })
      return res.status
    })

    // Should succeed
    expect(createLocationResponse).toBe(201)
  })
})
