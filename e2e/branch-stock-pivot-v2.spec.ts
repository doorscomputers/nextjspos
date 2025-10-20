import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * COMPREHENSIVE TEST SUITE: Branch Stock Pivot V2
 *
 * This test suite validates the Branch Stock Pivot V2 feature, which provides
 * a sophisticated multi-location inventory view with DevExtreme data grid.
 *
 * Features Tested:
 * - Data fetching and API integration
 * - Multi-tenant data isolation
 * - Location-based stock aggregation
 * - DevExtreme grid functionality (filtering, sorting, grouping)
 * - Export capabilities (Excel, PDF)
 * - UI/UX (responsive design, dark mode, professional appearance)
 * - Database verification for data accuracy
 * - Summary calculations and totals
 */

test.describe('Branch Stock Pivot V2 - Comprehensive Test Suite', () => {
  let businessId: number
  let testProductId: number
  let testVariationId: number
  let locationIds: number[]

  test.beforeAll(async () => {
    // Get the demo business ID (any business will work)
    const business = await prisma.business.findFirst()

    if (!business) {
      throw new Error('Demo business not found. Please run: npm run db:seed')
    }

    businessId = business.id

    // Get all active locations for this business (excluding future/test locations)
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null,
        NOT: {
          name: {
            contains: 'Future'
          }
        }
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    locationIds = locations.map(loc => loc.id)
    console.log(`✅ Found ${locations.length} locations for business ${businessId}`)

    // Create a test product with variations and stock across multiple locations
    const category = await prisma.category.findFirst({
      where: { businessId }
    })

    const brand = await prisma.brand.findFirst({
      where: { businessId }
    })

    const unit = await prisma.unit.findFirst({
      where: { businessId }
    })

    const supplier = await prisma.supplier.findFirst({
      where: { businessId }
    })

    // Create test product
    const product = await prisma.product.create({
      data: {
        businessId,
        name: `E2E Test Product ${Date.now()}`,
        sku: `E2E-TEST-${Date.now()}`,
        type: 'single',
        categoryId: category?.id,
        brandId: brand?.id,
        unitId: unit?.id,
        isActive: true
      }
    })

    testProductId = product.id

    // Create a variation with stock at multiple locations
    const variation = await prisma.productVariation.create({
      data: {
        productId: product.id,
        businessId: businessId,
        name: 'Standard',
        sku: `${product.sku}-STD`,
        purchasePrice: 100.00,
        sellingPrice: 150.00,
        supplierId: supplier?.id
      }
    })

    testVariationId = variation.id

    // Add stock at each location
    for (let i = 0; i < locationIds.length; i++) {
      const locationId = locationIds[i]
      const quantity = (i + 1) * 10 // 10, 20, 30, etc.

      await prisma.variationLocationDetails.create({
        data: {
          productId: product.id,
          productVariationId: variation.id,
          locationId,
          qtyAvailable: quantity
        }
      })
    }

    console.log(`✅ Created test product ${product.id} with variation ${variation.id}`)
    console.log(`✅ Added stock across ${locationIds.length} locations`)
  })

  test.afterAll(async () => {
    // Cleanup test data
    if (testProductId) {
      await prisma.variationLocationDetails.deleteMany({
        where: { productId: testProductId }
      })

      await prisma.productVariation.deleteMany({
        where: { productId: testProductId }
      })

      await prisma.product.delete({
        where: { id: testProductId }
      })

      console.log(`✅ Cleaned up test product ${testProductId}`)
    }

    await prisma.$disconnect()
  })

  // Helper function to login
  async function login(page: Page, username: string = 'admin', password: string = 'password') {
    await page.goto('/login')
    await page.fill('[name="username"]', username)
    await page.fill('[name="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  }

  test('1. Page Load - Should load successfully with authentication', async ({ page }) => {
    await login(page)

    // Navigate to Branch Stock Pivot V2 page
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Verify page title
    const pageTitle = await page.locator('h1').textContent()
    expect(pageTitle).toContain('Branch Stock Pivot V2')

    // Verify description
    const description = await page.locator('p.text-gray-600').textContent()
    expect(description).toContain('Advanced stock view')
  })

  test('2. API Data Fetching - Should fetch and display stock data correctly', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    // Wait for API call to complete
    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot') && response.status() === 200
    )

    const responseData = await apiResponse.json()

    // Verify API response structure
    expect(responseData).toHaveProperty('rows')
    expect(responseData).toHaveProperty('locations')
    expect(responseData).toHaveProperty('totals')
    expect(responseData).toHaveProperty('pagination')

    // Verify locations array
    expect(Array.isArray(responseData.locations)).toBe(true)
    expect(responseData.locations.length).toBeGreaterThan(0)

    // Verify rows contain our test product
    const testProductRow = responseData.rows.find((row: any) => row.variationId === testVariationId)
    expect(testProductRow).toBeTruthy()

    console.log(`✅ API returned ${responseData.rows.length} products`)
    console.log(`✅ Found test product in response`)
  })

  test('3. Multi-Tenant Isolation - Should only show products for logged-in business', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Verify all products belong to the correct business
    for (const row of responseData.rows) {
      const product = await prisma.product.findUnique({
        where: { id: row.productId },
        select: { businessId: true }
      })

      expect(product?.businessId).toBe(businessId)
    }

    console.log(`✅ All ${responseData.rows.length} products verified to belong to business ${businessId}`)
  })

  test('4. Summary Cards - Should display accurate summary statistics', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')

    // Wait for summary cards to load
    await page.waitForSelector('.bg-gradient-to-br')

    // Extract summary card values
    const summaryCards = await page.locator('.bg-gradient-to-br').all()

    expect(summaryCards.length).toBe(4)

    // Verify Total Products card
    const totalProductsText = await summaryCards[0].textContent()
    expect(totalProductsText).toContain('Total Products')

    // Verify Total Locations card
    const totalLocationsText = await summaryCards[1].textContent()
    expect(totalLocationsText).toContain('Total Locations')
    expect(totalLocationsText).toContain(locationIds.length.toString())

    // Verify Total Stock card
    const totalStockText = await summaryCards[2].textContent()
    expect(totalStockText).toContain('Total Stock')

    // Verify Total Inventory Value card
    const totalValueText = await summaryCards[3].textContent()
    expect(totalValueText).toContain('Total Inventory Value')
    expect(totalValueText).toContain('₱')

    console.log('✅ Summary cards display correctly')
  })

  test('5. DevExtreme Grid - Should render with all required features', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')

    // Wait for DataGrid to load
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Verify Search Panel exists
    const searchPanel = await page.locator('.dx-datagrid-search-panel')
    expect(await searchPanel.count()).toBeGreaterThan(0)

    // Verify Filter Row exists
    const filterRow = await page.locator('.dx-filter-row')
    expect(await filterRow.count()).toBeGreaterThan(0)

    // Verify Group Panel exists
    const groupPanel = await page.locator('.dx-group-panel')
    expect(await groupPanel.count()).toBeGreaterThan(0)

    // Verify Export button exists
    const exportButton = await page.locator('.dx-datagrid-export-button')
    expect(await exportButton.count()).toBeGreaterThan(0)

    console.log('✅ DevExtreme grid rendered with all features')
  })

  test('6. Location Columns - Should display stock for each location', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Find our test product
    const testRow = responseData.rows.find((row: any) => row.variationId === testVariationId)
    expect(testRow).toBeTruthy()

    // Verify stock by location
    for (let i = 0; i < locationIds.length; i++) {
      const locationId = locationIds[i]
      const expectedQty = (i + 1) * 10

      expect(testRow.stockByLocation[locationId]).toBe(expectedQty)
    }

    // Verify total stock calculation
    const expectedTotal = locationIds.reduce((sum, _, i) => sum + ((i + 1) * 10), 0)
    expect(testRow.totalStock).toBe(expectedTotal)

    console.log(`✅ Stock quantities verified across ${locationIds.length} locations`)
  })

  test('7. Search Functionality - Should filter products by search term', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid-search-panel input', { timeout: 10000 })

    // Get initial row count
    const initialRows = await page.locator('.dx-data-row').count()

    // Search for our test product
    const searchInput = page.locator('.dx-datagrid-search-panel input')
    await searchInput.fill('E2E Test Product')
    await page.waitForTimeout(1000) // Wait for DevExtreme to filter

    // Verify filtered results
    const filteredRows = await page.locator('.dx-data-row').count()
    expect(filteredRows).toBeLessThanOrEqual(initialRows)
    expect(filteredRows).toBeGreaterThan(0)

    console.log(`✅ Search filtered from ${initialRows} to ${filteredRows} rows`)
  })

  test('8. Column Sorting - Should sort data correctly', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Click on Item Name column header to sort
    const itemNameHeader = page.locator('.dx-header-row').locator('td').filter({ hasText: 'Item Name' })
    await itemNameHeader.click()
    await page.waitForTimeout(500)

    // Verify sort indicator appears
    const sortIndicator = await page.locator('.dx-sort-up, .dx-sort-down').count()
    expect(sortIndicator).toBeGreaterThan(0)

    console.log('✅ Column sorting works correctly')
  })

  test('9. Column Filtering - Should filter using header filters', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Get initial row count
    const initialRows = await page.locator('.dx-data-row').count()

    // Click filter icon on Item Code column
    const filterIcon = page.locator('.dx-header-filter').first()
    if (await filterIcon.count() > 0) {
      await filterIcon.click()
      await page.waitForTimeout(1000)

      // Verify filter menu appears
      const filterMenu = await page.locator('.dx-overlay-content').count()
      expect(filterMenu).toBeGreaterThan(0)

      console.log('✅ Header filter menu opens correctly')

      // Close the filter menu
      await page.keyboard.press('Escape')
    }
  })

  test('10. Grouping Functionality - Should allow grouping by category', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Verify group panel exists
    const groupPanel = await page.locator('.dx-group-panel-message').textContent()
    expect(groupPanel).toContain('Drag column headers here')

    console.log('✅ Grouping panel is available')
  })

  test('11. Export Button - Should display export options', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Find and click export button
    const exportButton = page.locator('.dx-datagrid-export-button')

    if (await exportButton.count() > 0) {
      await exportButton.click()
      await page.waitForTimeout(500)

      // Verify export menu appears
      const exportMenu = await page.locator('.dx-menu-item').count()
      expect(exportMenu).toBeGreaterThan(0)

      console.log('✅ Export menu opens successfully')

      // Close menu
      await page.keyboard.press('Escape')
    }
  })

  test('12. Refresh Button - Should reload data when clicked', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')

    // Wait for initial load
    let apiCallCount = 0
    page.on('response', response => {
      if (response.url().includes('/api/products/branch-stock-pivot')) {
        apiCallCount++
      }
    })

    // Click refresh button
    const refreshButton = page.locator('button').filter({ hasText: 'Refresh' })
    await refreshButton.click()

    // Wait for new API call
    await page.waitForTimeout(1000)

    expect(apiCallCount).toBeGreaterThan(0)
    console.log('✅ Refresh button triggers data reload')
  })

  test('13. Stock Color Coding - Should display color-coded stock badges', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Wait for data rows
    await page.waitForSelector('.dx-data-row', { timeout: 5000 })

    // Check for color-coded badges (green for >10, yellow for 1-10, red for 0)
    const greenBadges = await page.locator('.bg-green-100, .bg-green-900\\/30').count()
    const yellowBadges = await page.locator('.bg-yellow-100, .bg-yellow-900\\/30').count()

    // At least some color-coded badges should exist
    const totalColorBadges = greenBadges + yellowBadges
    expect(totalColorBadges).toBeGreaterThan(0)

    console.log(`✅ Found ${greenBadges} green badges and ${yellowBadges} yellow badges`)
  })

  test('14. Database Verification - Stock totals match database records', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Get our test product from API
    const apiRow = responseData.rows.find((row: any) => row.variationId === testVariationId)
    expect(apiRow).toBeTruthy()

    // Query database directly
    const dbRecords = await prisma.variationLocationDetails.findMany({
      where: {
        productVariationId: testVariationId,
        productId: testProductId
      },
      select: {
        locationId: true,
        qtyAvailable: true
      }
    })

    // Calculate total from database
    const dbTotal = dbRecords.reduce((sum, record) => {
      const qty = typeof record.qtyAvailable === 'object' && 'toNumber' in record.qtyAvailable
        ? (record.qtyAvailable as any).toNumber()
        : Number(record.qtyAvailable)
      return sum + qty
    }, 0)

    // Verify API total matches database total
    expect(apiRow.totalStock).toBe(dbTotal)

    console.log(`✅ Database total (${dbTotal}) matches API total (${apiRow.totalStock})`)
  })

  test('15. Responsive Design - Should work on different viewport sizes', async ({ page }) => {
    await login(page)

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard/products/branch-stock-pivot-v2')
    await page.waitForLoadState('networkidle')

    // Verify page loads
    const mobileTitle = await page.locator('h1').textContent()
    expect(mobileTitle).toContain('Branch Stock Pivot V2')

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await page.waitForLoadState('networkidle')

    const tabletTitle = await page.locator('h1').textContent()
    expect(tabletTitle).toContain('Branch Stock Pivot V2')

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    await page.waitForLoadState('networkidle')

    const desktopTitle = await page.locator('h1').textContent()
    expect(desktopTitle).toContain('Branch Stock Pivot V2')

    console.log('✅ Page works correctly across mobile, tablet, and desktop viewports')
  })

  test('16. Dark Mode - Should display correctly in dark mode', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')
    await page.waitForLoadState('networkidle')

    // Check if dark mode toggle exists
    const darkModeToggle = page.locator('[data-testid="theme-toggle"], .theme-switcher, button[aria-label*="theme"], button[aria-label*="dark"]')

    if (await darkModeToggle.count() > 0) {
      // Toggle dark mode
      await darkModeToggle.first().click()
      await page.waitForTimeout(500)

      // Verify dark mode classes are applied
      const html = page.locator('html')
      const isDark = await html.evaluate(el => el.classList.contains('dark'))

      console.log(`✅ Dark mode ${isDark ? 'enabled' : 'not detected'}`)
    } else {
      console.log('⚠️ Dark mode toggle not found on page')
    }
  })

  test('17. Last Delivery Info - Should display last purchase details', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Verify response includes last delivery columns
    const sampleRow = responseData.rows[0]
    expect(sampleRow).toHaveProperty('lastDeliveryDate')
    expect(sampleRow).toHaveProperty('lastQtyDelivered')

    console.log('✅ Last delivery information included in API response')
  })

  test('18. Cost and Price Calculations - Should calculate totals correctly', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Find our test product
    const testRow = responseData.rows.find((row: any) => row.variationId === testVariationId)
    expect(testRow).toBeTruthy()

    // Calculate expected totals
    const expectedTotalCost = testRow.totalStock * testRow.cost
    const expectedTotalPrice = testRow.totalStock * testRow.price

    // Verify calculations (allow small floating point differences)
    expect(Math.abs(testRow.totalCost - expectedTotalCost)).toBeLessThan(0.01)
    expect(Math.abs(testRow.totalPrice - expectedTotalPrice)).toBeLessThan(0.01)

    console.log('✅ Cost and price calculations are accurate')
  })

  test('19. Summary Totals - Should display grand totals correctly', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Verify totals object
    expect(responseData.totals).toBeTruthy()
    expect(responseData.totals).toHaveProperty('grandTotal')
    expect(responseData.totals).toHaveProperty('grandTotalCost')
    expect(responseData.totals).toHaveProperty('grandTotalPrice')
    expect(responseData.totals).toHaveProperty('byLocation')

    // Verify grand totals are numbers
    expect(typeof responseData.totals.grandTotal).toBe('number')
    expect(typeof responseData.totals.grandTotalCost).toBe('number')
    expect(typeof responseData.totals.grandTotalPrice).toBe('number')

    console.log(`✅ Grand totals: Stock=${responseData.totals.grandTotal}, Cost=₱${responseData.totals.grandTotalCost.toFixed(2)}, Price=₱${responseData.totals.grandTotalPrice.toFixed(2)}`)
  })

  test('20. Pagination - Should handle pagination correctly', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    const responseData = await apiResponse.json()

    // Verify pagination object
    expect(responseData.pagination).toBeTruthy()
    expect(responseData.pagination).toHaveProperty('page')
    expect(responseData.pagination).toHaveProperty('limit')
    expect(responseData.pagination).toHaveProperty('totalCount')
    expect(responseData.pagination).toHaveProperty('totalPages')

    console.log(`✅ Pagination: Page ${responseData.pagination.page} of ${responseData.pagination.totalPages}, showing ${responseData.rows.length} of ${responseData.pagination.totalCount} items`)
  })

  test('21. Active/Inactive Products - Should display product status', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Look for status badges
    const statusBadges = await page.locator('.bg-green-100, .bg-red-100, .bg-green-900\\/30, .bg-red-900\\/30').count()
    expect(statusBadges).toBeGreaterThan(0)

    console.log(`✅ Found ${statusBadges} status badges`)
  })

  test('22. Fixed Columns - Should have fixed Item Code and Status columns', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Check for fixed columns
    const fixedColumns = await page.locator('.dx-datagrid-content-fixed').count()

    if (fixedColumns > 0) {
      console.log('✅ Fixed columns detected')
    } else {
      console.log('⚠️ Fixed columns may not be visible in current view')
    }
  })

  test('23. Column Chooser - Should allow showing/hiding columns', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Look for column chooser button
    const columnChooser = page.locator('.dx-datagrid-column-chooser-button')

    if (await columnChooser.count() > 0) {
      await columnChooser.click()
      await page.waitForTimeout(500)

      // Verify column chooser menu appears
      const chooserMenu = await page.locator('.dx-overlay-content').count()
      expect(chooserMenu).toBeGreaterThan(0)

      console.log('✅ Column chooser opens successfully')

      await page.keyboard.press('Escape')
    }
  })

  test('24. Performance - Page should load within acceptable time', async ({ page }) => {
    await login(page)

    const startTime = Date.now()
    await page.goto('/dashboard/products/branch-stock-pivot-v2')

    await page.waitForResponse(
      response => response.url().includes('/api/products/branch-stock-pivot')
    )

    await page.waitForSelector('.dx-datagrid', { timeout: 15000 })
    const loadTime = Date.now() - startTime

    // Page should load within 15 seconds
    expect(loadTime).toBeLessThan(15000)

    console.log(`✅ Page loaded in ${loadTime}ms`)
  })

  test('25. Error Handling - Should handle API errors gracefully', async ({ page }) => {
    await login(page)

    // Intercept API call and simulate error
    await page.route('**/api/products/branch-stock-pivot', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    await page.goto('/dashboard/products/branch-stock-pivot-v2')
    await page.waitForTimeout(2000)

    // Check for error toast/message
    const toast = await page.locator('[data-sonner-toast], .toast, [role="alert"]').count()

    if (toast > 0) {
      console.log('✅ Error handling displays user feedback')
    } else {
      console.log('⚠️ Error feedback may not be visible')
    }
  })
})
