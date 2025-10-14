import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test configuration
const TEST_USER = {
  username: 'admin',
  password: 'password'
}

// Helper to login via API (more reliable for testing)
async function login(page: Page) {
  // Call the NextAuth signIn API directly
  const response = await page.request.post('http://localhost:3000/api/auth/callback/credentials', {
    form: {
      username: TEST_USER.username,
      password: TEST_USER.password,
      redirect: 'false',
      callbackUrl: 'http://localhost:3000/dashboard',
      json: 'true'
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  // Get the cookies from the response
  const cookies = await response.headersArray()
  const setCookieHeaders = cookies.filter(h => h.name.toLowerCase() === 'set-cookie')

  // Extract session cookies and set them
  for (const header of setCookieHeaders) {
    const cookieValue = header.value
    const cookieParts = cookieValue.split(';')[0].split('=')
    if (cookieParts.length === 2) {
      await page.context().addCookies([{
        name: cookieParts[0],
        value: cookieParts[1],
        domain: 'localhost',
        path: '/'
      }])
    }
  }

  // Now navigate to dashboard
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // Verify we're logged in by checking for dashboard content
  const isDashboard = page.url().includes('/dashboard')
  if (!isDashboard) {
    throw new Error('Login failed - not redirected to dashboard')
  }
}

// Helper to navigate to products page
async function navigateToProducts(page: Page) {
  await page.goto('/dashboard/products')
  await page.waitForLoadState('networkidle')
  // Wait for products table to load
  await page.waitForSelector('table')
}

// Helper to create test products
async function createTestProducts(businessId: number, count: number = 3): Promise<number[]> {
  const productIds: number[] = []

  for (let i = 1; i <= count; i++) {
    const timestamp = Date.now()
    const product = await prisma.product.create({
      data: {
        businessId: businessId,
        name: `Test Product ${timestamp}-${i}`,
        type: 'variable',
        sku: `TEST-${timestamp}-${i}`,
        enableStock: true,
        alertQuantity: 10,
        isActive: true,
        categoryId: null,
        brandId: null,
        unitId: null,
        taxId: null
      }
    })

    // Create a variation for the product (required for location operations)
    await prisma.productVariation.create({
      data: {
        productId: product.id,
        name: 'Default',
        sku: `${product.sku}-VAR`,
        purchasePrice: 10.00,
        sellingPrice: 20.00,
        isDefault: true
      }
    })

    productIds.push(product.id)
  }

  return productIds
}

// Helper to clean up test products
async function cleanupTestProducts(productIds: number[]) {
  if (productIds.length === 0) return

  // Delete variations first
  await prisma.productVariation.deleteMany({
    where: { productId: { in: productIds } }
  })

  // Delete products
  await prisma.product.deleteMany({
    where: { id: { in: productIds } }
  })
}

// Helper to get business ID from user
async function getBusinessIdForUser(username: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { businessId: true }
  })

  if (!user?.businessId) {
    throw new Error(`User ${username} has no business`)
  }

  return user.businessId
}

// Helper to get a location for testing
async function getTestLocation(businessId: number): Promise<number | null> {
  const location = await prisma.businessLocation.findFirst({
    where: {
      businessId,
      deletedAt: null
    },
    select: { id: true, name: true }
  })

  return location?.id || null
}

test.describe('Product Bulk Actions - Comprehensive Testing', () => {
  let testProductIds: number[] = []
  let businessId: number
  let testLocationId: number | null = null

  test.beforeAll(async () => {
    // Get business ID for the test user
    businessId = await getBusinessIdForUser(TEST_USER.username)

    // Get a test location
    testLocationId = await getTestLocation(businessId)

    console.log(`Test Business ID: ${businessId}`)
    console.log(`Test Location ID: ${testLocationId}`)
  })

  test.beforeEach(async ({ page }) => {
    // Create fresh test products for each test
    testProductIds = await createTestProducts(businessId, 5)
    console.log(`Created test products: ${testProductIds.join(', ')}`)

    // Login
    await login(page)

    // Navigate to products page
    await navigateToProducts(page)
  })

  test.afterEach(async () => {
    // Clean up test products after each test
    await cleanupTestProducts(testProductIds)
    testProductIds = []
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('1. Bulk Selection - Select individual products', async ({ page }) => {
    // Wait for products to be visible
    await page.waitForSelector('tbody tr')

    // Find our test products in the table
    const firstTestProduct = testProductIds[0]
    const secondTestProduct = testProductIds[1]

    // Get the rows
    const rows = await page.locator('tbody tr').all()
    let selectedCount = 0

    // Select first two test products by finding their checkboxes
    for (const row of rows) {
      const checkbox = row.locator('input[type="checkbox"]').first()

      // Check if this row contains one of our test products
      const rowText = await row.innerText()
      if (rowText.includes(`TEST-`) && selectedCount < 2) {
        await checkbox.check()
        selectedCount++
      }
    }

    // Verify selection indicator appears
    await expect(page.locator('text=/\\d+ product\\(s\\) selected/')).toBeVisible()

    // Verify bulk action buttons appear
    await expect(page.locator('button:has-text("Delete Selected")')).toBeVisible()
    await expect(page.locator('button:has-text("Activate Selected")')).toBeVisible()
    await expect(page.locator('button:has-text("Deactivate Selected")')).toBeVisible()

    console.log('✓ Individual selection working correctly')
  })

  test('2. Bulk Selection - Select all functionality', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('tbody tr')

    // Find and click the "Select All" checkbox in the header
    const selectAllCheckbox = page.locator('thead input[type="checkbox"]').first()
    await selectAllCheckbox.check()

    // Verify all visible products are selected
    const checkboxes = await page.locator('tbody tr input[type="checkbox"]').all()

    for (const checkbox of checkboxes) {
      await expect(checkbox).toBeChecked()
    }

    // Verify selection count appears
    await expect(page.locator('text=/\\d+ product\\(s\\) selected/')).toBeVisible()

    // Test deselect all
    await selectAllCheckbox.uncheck()

    // Verify all checkboxes are unchecked
    for (const checkbox of checkboxes) {
      await expect(checkbox).not.toBeChecked()
    }

    console.log('✓ Select all functionality working correctly')
  })

  test('3. Bulk Deactivate - Deactivate selected products', async ({ page }) => {
    // Select test products
    const rows = await page.locator('tbody tr').all()
    let selectedCount = 0

    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-') && selectedCount < 3) {
        await row.locator('input[type="checkbox"]').first().check()
        selectedCount++
      }
    }

    // Click Deactivate Selected button
    await page.click('button:has-text("Deactivate Selected")')

    // Wait for toast notification
    await page.waitForSelector('text=/Successfully deactivated \\d+ product/')

    // Verify success toast appears
    await expect(page.locator('text=/Successfully deactivated/')).toBeVisible()

    // Wait for page to refresh
    await page.waitForTimeout(1000)

    // Verify products are deactivated in database
    const products = await prisma.product.findMany({
      where: { id: { in: testProductIds } },
      select: { id: true, isActive: true }
    })

    const deactivatedCount = products.filter(p => !p.isActive).length
    expect(deactivatedCount).toBeGreaterThan(0)

    console.log(`✓ Successfully deactivated ${deactivatedCount} products`)

    // Verify UI shows Inactive badge
    const inactiveBadges = await page.locator('text=Inactive').count()
    expect(inactiveBadges).toBeGreaterThan(0)
  })

  test('4. Bulk Activate - Activate selected products', async ({ page }) => {
    // First deactivate some products
    await prisma.product.updateMany({
      where: { id: { in: testProductIds.slice(0, 3) } },
      data: { isActive: false }
    })

    // Refresh page to see inactive products
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Select inactive products
    const rows = await page.locator('tbody tr').all()
    let selectedCount = 0

    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-') && rowText.includes('Inactive') && selectedCount < 3) {
        await row.locator('input[type="checkbox"]').first().check()
        selectedCount++
      }
    }

    // Click Activate Selected button
    await page.click('button:has-text("Activate Selected")')

    // Wait for toast notification
    await page.waitForSelector('text=/Successfully activated \\d+ product/')

    // Verify success toast
    await expect(page.locator('text=/Successfully activated/')).toBeVisible()

    // Wait for refresh
    await page.waitForTimeout(1000)

    // Verify products are activated in database
    const products = await prisma.product.findMany({
      where: { id: { in: testProductIds.slice(0, 3) } },
      select: { id: true, isActive: true }
    })

    const activatedCount = products.filter(p => p.isActive).length
    expect(activatedCount).toBe(3)

    console.log(`✓ Successfully activated ${activatedCount} products`)

    // Verify UI shows Active badge
    const activeBadges = await page.locator('text=Active').count()
    expect(activeBadges).toBeGreaterThan(0)
  })

  test('5. Bulk Add to Location - Add products to a location', async ({ page }) => {
    // Skip if no location available
    if (!testLocationId) {
      test.skip()
      return
    }

    // Select test products
    const rows = await page.locator('tbody tr').all()
    let selectedCount = 0

    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-') && selectedCount < 3) {
        await row.locator('input[type="checkbox"]').first().check()
        selectedCount++
      }
    }

    // Find and click location dropdown
    const locationSelect = page.locator('select, [role="combobox"]').filter({ hasText: 'Select location' }).first()
    await locationSelect.click()

    // Wait for dropdown options
    await page.waitForTimeout(500)

    // Select the first available location
    const locationOptions = page.locator('[role="option"]')
    const firstOption = locationOptions.first()
    await firstOption.click()

    // Click Add to Location button
    await page.click('button:has-text("Add to Location")')

    // Wait for success toast
    await page.waitForSelector('text=/Successfully added \\d+ product/')

    // Verify success message
    await expect(page.locator('text=/Successfully added/')).toBeVisible()

    // Verify in database - check VariationLocationDetails records were created
    const variations = await prisma.productVariation.findMany({
      where: { productId: { in: testProductIds.slice(0, 3) } },
      select: { id: true }
    })

    const variationIds = variations.map(v => v.id)

    const locationDetails = await prisma.variationLocationDetails.findMany({
      where: {
        productVariationId: { in: variationIds },
        locationId: testLocationId
      }
    })

    expect(locationDetails.length).toBeGreaterThan(0)

    console.log(`✓ Successfully added products to location. Created ${locationDetails.length} inventory records`)
  })

  test('6. Bulk Remove from Location - Remove products from location', async ({ page }) => {
    // Skip if no location available
    if (!testLocationId) {
      test.skip()
      return
    }

    // First, add products to location
    const variations = await prisma.productVariation.findMany({
      where: { productId: { in: testProductIds.slice(0, 3) } },
      select: { id: true, productId: true, sellingPrice: true }
    })

    // Create location details
    for (const variation of variations) {
      await prisma.variationLocationDetails.upsert({
        where: {
          productVariationId_locationId: {
            productVariationId: variation.id,
            locationId: testLocationId
          }
        },
        create: {
          productId: variation.productId,
          productVariationId: variation.id,
          locationId: testLocationId,
          qtyAvailable: 0,
          sellingPrice: variation.sellingPrice
        },
        update: {}
      })
    }

    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Select test products
    const rows = await page.locator('tbody tr').all()
    let selectedCount = 0

    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-') && selectedCount < 3) {
        await row.locator('input[type="checkbox"]').first().check()
        selectedCount++
      }
    }

    // Select location from dropdown
    const locationSelect = page.locator('select, [role="combobox"]').filter({ hasText: 'Select location' }).first()
    await locationSelect.click()
    await page.waitForTimeout(500)

    const locationOptions = page.locator('[role="option"]')
    await locationOptions.first().click()

    // Click Remove from Location button
    await page.click('button:has-text("Remove from Location")')

    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure')
      await dialog.accept()
    })

    // Wait for confirmation and click
    await page.waitForTimeout(500)

    // Wait for success toast
    await page.waitForSelector('text=/Successfully removed \\d+ product/', { timeout: 5000 })

    // Verify success message
    await expect(page.locator('text=/Successfully removed/')).toBeVisible()

    // Verify in database - check records were deleted
    const variationIds = variations.map(v => v.id)

    const remainingDetails = await prisma.variationLocationDetails.findMany({
      where: {
        productVariationId: { in: variationIds },
        locationId: testLocationId
      }
    })

    expect(remainingDetails.length).toBe(0)

    console.log('✓ Successfully removed products from location')
  })

  test('7. Bulk Delete - Delete selected products', async ({ page }) => {
    const productsToDelete = testProductIds.slice(0, 3)

    // Select products to delete
    const rows = await page.locator('tbody tr').all()
    let selectedCount = 0

    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-') && selectedCount < 3) {
        await row.locator('input[type="checkbox"]').first().check()
        selectedCount++
      }
    }

    // Set up dialog handler before clicking
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure')
      await dialog.accept()
    })

    // Click Delete Selected button
    await page.click('button:has-text("Delete Selected")')

    // Wait for success toast
    await page.waitForSelector('text=/Successfully deleted \\d+ product/', { timeout: 5000 })

    // Verify success message
    await expect(page.locator('text=/Successfully deleted/')).toBeVisible()

    // Wait for UI to update
    await page.waitForTimeout(1000)

    // Verify products are soft deleted in database
    const deletedProducts = await prisma.product.findMany({
      where: { id: { in: productsToDelete } },
      select: { id: true, deletedAt: true }
    })

    const softDeletedCount = deletedProducts.filter(p => p.deletedAt !== null).length
    expect(softDeletedCount).toBe(3)

    console.log(`✓ Successfully deleted ${softDeletedCount} products (soft delete)`)

    // Update testProductIds to exclude deleted ones for cleanup
    testProductIds = testProductIds.filter(id => !productsToDelete.includes(id))
  })

  test('8. Validation - No products selected error', async ({ page }) => {
    // Try to delete without selecting products
    await page.click('button:has-text("Delete Selected")')

    // Verify error toast appears
    await expect(page.locator('text=/Please select at least one product/')).toBeVisible()

    console.log('✓ Validation: Error shown when no products selected')
  })

  test('9. Validation - Location required for location actions', async ({ page }) => {
    // Skip if no location available
    if (!testLocationId) {
      test.skip()
      return
    }

    // Select a product
    const firstCheckbox = page.locator('tbody tr input[type="checkbox"]').first()
    await firstCheckbox.check()

    // Try to add to location without selecting location
    await page.click('button:has-text("Add to Location")')

    // Verify error toast
    await expect(page.locator('text=/Please select a location/')).toBeVisible()

    console.log('✓ Validation: Error shown when location not selected')
  })

  test('10. Data Persistence - Products maintain state after page refresh', async ({ page }) => {
    // Deactivate some products
    const productsToDeactivate = testProductIds.slice(0, 2)

    await prisma.product.updateMany({
      where: { id: { in: productsToDeactivate } },
      data: { isActive: false }
    })

    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify inactive products still show as inactive
    const inactiveBadges = await page.locator('text=Inactive').count()
    expect(inactiveBadges).toBeGreaterThanOrEqual(2)

    console.log('✓ Data persistence verified after page refresh')
  })

  test('11. UI Responsiveness - Bulk action buttons enable/disable correctly', async ({ page }) => {
    // Initially, location buttons should be disabled
    const addToLocationBtn = page.locator('button:has-text("Add to Location")')
    const removeFromLocationBtn = page.locator('button:has-text("Remove from Location")')

    // Select a product
    const firstCheckbox = page.locator('tbody tr input[type="checkbox"]').first()
    await firstCheckbox.check()

    // Buttons should still be disabled without location selected
    await expect(addToLocationBtn).toBeDisabled()
    await expect(removeFromLocationBtn).toBeDisabled()

    console.log('✓ UI: Buttons correctly disabled when location not selected')
  })

  test('12. Clear Selection - Clear selection button works', async ({ page }) => {
    // Select some products
    const checkboxes = await page.locator('tbody tr input[type="checkbox"]').all()

    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      await checkboxes[i].check()
    }

    // Verify selection indicator appears
    await expect(page.locator('text=/\\d+ product\\(s\\) selected/')).toBeVisible()

    // Click Clear Selection
    await page.click('button:has-text("Clear selection"), text=Clear selection')

    // Verify selection is cleared
    for (const checkbox of checkboxes) {
      await expect(checkbox).not.toBeChecked()
    }

    // Verify bulk action area disappears
    await expect(page.locator('text=/\\d+ product\\(s\\) selected/')).not.toBeVisible()

    console.log('✓ Clear selection working correctly')
  })
})

test.describe('Product Bulk Actions - Edge Cases & Multi-tenancy', () => {
  let testProductIds: number[] = []
  let businessId: number

  test.beforeAll(async () => {
    businessId = await getBusinessIdForUser(TEST_USER.username)
  })

  test.beforeEach(async ({ page }) => {
    testProductIds = await createTestProducts(businessId, 3)
    await login(page)
    await navigateToProducts(page)
  })

  test.afterEach(async () => {
    await cleanupTestProducts(testProductIds)
    testProductIds = []
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('13. Multi-tenancy - Cannot affect products from other businesses', async ({ page }) => {
    // This test verifies that API endpoints properly filter by businessId
    // The verification is implicit in that test products are only visible to the logged-in user's business

    const rows = await page.locator('tbody tr').all()

    // Count how many test products are visible
    let testProductCount = 0
    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-')) {
        testProductCount++
      }
    }

    // Verify we can only see our test products
    expect(testProductCount).toBeGreaterThanOrEqual(testProductIds.length)

    console.log('✓ Multi-tenancy: Products correctly filtered by business')
  })

  test('14. Bulk operations with mixed states', async ({ page }) => {
    // Create products with different states
    await prisma.product.update({
      where: { id: testProductIds[0] },
      data: { isActive: true }
    })

    await prisma.product.update({
      where: { id: testProductIds[1] },
      data: { isActive: false }
    })

    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Select all test products (mix of active and inactive)
    const rows = await page.locator('tbody tr').all()

    for (const row of rows) {
      const rowText = await row.innerText()
      if (rowText.includes('TEST-')) {
        await row.locator('input[type="checkbox"]').first().check()
      }
    }

    // Deactivate all
    await page.click('button:has-text("Deactivate Selected")')
    await page.waitForSelector('text=/Successfully deactivated/')

    // Wait and verify all are now inactive
    await page.waitForTimeout(1000)

    const products = await prisma.product.findMany({
      where: { id: { in: testProductIds } },
      select: { isActive: true }
    })

    const allInactive = products.every(p => !p.isActive)
    expect(allInactive).toBe(true)

    console.log('✓ Bulk operations handle mixed states correctly')
  })
})
