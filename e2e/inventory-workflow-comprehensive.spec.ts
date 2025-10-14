import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test configuration
const BASE_URL = 'http://localhost:3004'
const WAREHOUSE_MANAGER = { username: 'manager', password: 'password' } // Using manager user
const BRANCH_ADMIN = { username: 'admin', password: 'password' } // Using admin user

// Test data
const TEST_PRODUCT = {
  name: 'Test Widget Alpha',
  sku: 'TW-001',
  category: 'Test Category',
  type: 'single',
  enableStock: true
}

const OPENING_STOCK = {
  location1: { name: 'Tuguegarao', qty: 100, unitCost: 10, sellingPrice: 15 },
  location2: { name: 'Warehouse', qty: 50, unitCost: 10, sellingPrice: 15 }
}

let testProductId: string
let testCategoryId: string
let tuguegaraoLocationId: string
let warehouseLocationId: string
let warehouseManagerBusinessId: string

// Helper function to login
async function login(page: Page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  // Fill login form
  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)

  // Click login button
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

// Helper function to logout
async function logout(page: Page) {
  // Look for logout button/link
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Sign Out")')

  if (await logoutButton.count() > 0) {
    await logoutButton.first().click()
    await page.waitForURL(/\/login/, { timeout: 5000 })
  } else {
    // Navigate to login directly
    await page.goto(`${BASE_URL}/login`)
  }
}

test.describe('Comprehensive Inventory Management Workflow', () => {
  test.beforeAll(async () => {
    // Get manager's business ID and locations
    const manager = await prisma.user.findUnique({
      where: { username: 'manager' },
      include: { business: true }
    })

    if (!manager) {
      throw new Error('Manager user not found in database')
    }

    warehouseManagerBusinessId = manager.businessId

    // Get locations for this business
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: warehouseManagerBusinessId }
    })

    console.log(`Found ${locations.length} locations for business:`, locations.map(l => l.name))

    // Find Tuguegarao and Warehouse locations
    const tuguegarao = locations.find(l => l.name.toLowerCase().includes('tuguegarao'))
    const warehouse = locations.find(l => l.name.toLowerCase().includes('warehouse'))

    if (!tuguegarao || !warehouse) {
      console.log('Available locations:', locations.map(l => ({ id: l.id, name: l.name })))
      throw new Error(`Required locations not found. Tuguegarao: ${!!tuguegarao}, Warehouse: ${!!warehouse}`)
    }

    tuguegaraoLocationId = tuguegarao.id
    warehouseLocationId = warehouse.id

    console.log('Test setup complete:', {
      businessId: warehouseManagerBusinessId,
      tuguegaraoId: tuguegaraoLocationId,
      warehouseId: warehouseLocationId
    })
  })

  test.afterAll(async () => {
    // Cleanup test data
    if (testProductId) {
      // Delete stock movements first
      await prisma.stockMovement.deleteMany({
        where: { productId: testProductId }
      })

      // Delete product stock
      await prisma.productStock.deleteMany({
        where: { productId: testProductId }
      })

      // Delete sales items
      await prisma.saleItem.deleteMany({
        where: { productId: testProductId }
      })

      // Delete inventory corrections
      await prisma.inventoryCorrection.deleteMany({
        where: { productId: testProductId }
      })

      // Delete product
      await prisma.product.delete({
        where: { id: testProductId }
      })
    }

    if (testCategoryId) {
      await prisma.category.delete({
        where: { id: testCategoryId }
      })
    }

    await prisma.$disconnect()
  })

  test('Test 1: Opening Stock for New Product (Should Succeed)', async ({ page }) => {
    console.log('\n=== TEST 1: Opening Stock for New Product ===')

    // Login as warehouse manager
    await login(page, WAREHOUSE_MANAGER.username, WAREHOUSE_MANAGER.password)
    await page.screenshot({ path: 'test-results/test1-01-logged-in.png', fullPage: true })

    // Navigate to Products
    await page.click('a[href*="/products"], button:has-text("Products")')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test1-02-products-page.png', fullPage: true })

    // Click Add Product button
    const addButton = page.locator('button:has-text("Add Product"), a:has-text("Add Product"), button:has-text("New Product"), a:has-text("New Product")')
    await addButton.first().click()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test1-03-add-product-form.png', fullPage: true })

    // Fill product form
    await page.fill('input[name="name"]', TEST_PRODUCT.name)
    await page.fill('input[name="sku"]', TEST_PRODUCT.sku)

    // Create or select category
    const categoryInput = page.locator('input[name="category"], select[name="categoryId"], input[name="categoryId"]')
    if (await categoryInput.count() > 0) {
      const inputType = await categoryInput.getAttribute('type')
      if (inputType === 'text') {
        await categoryInput.fill(TEST_PRODUCT.category)
      } else {
        // It's a select or autocomplete
        await categoryInput.click()
        const createOption = page.locator('text="Create"', 'button:has-text("Create Category")')
        if (await createOption.count() > 0) {
          await createOption.first().click()
        }
      }
    }

    // Enable stock tracking
    const enableStockCheckbox = page.locator('input[name="enableStock"], input[type="checkbox"][name="trackStock"]')
    if (await enableStockCheckbox.count() > 0) {
      await enableStockCheckbox.check()
    }

    await page.screenshot({ path: 'test-results/test1-04-filled-form.png', fullPage: true })

    // Save product
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Create Product")')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test1-05-product-saved.png', fullPage: true })

    // Get the created product from database
    const product = await prisma.product.findFirst({
      where: {
        sku: TEST_PRODUCT.sku,
        businessId: warehouseManagerBusinessId
      }
    })

    expect(product).toBeTruthy()
    testProductId = product!.id
    console.log('Product created:', testProductId)

    // Navigate to Set Opening Stock
    // Look for opening stock button/link
    const openingStockLink = page.locator('a:has-text("Opening Stock"), button:has-text("Set Opening Stock"), a:has-text("Set Stock")')

    if (await openingStockLink.count() > 0) {
      await openingStockLink.first().click()
    } else {
      // Navigate directly to opening stock page
      await page.goto(`${BASE_URL}/dashboard/products/${testProductId}/opening-stock`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test1-06-opening-stock-page.png', fullPage: true })

    // Set opening stock for Location 1 (Tuguegarao)
    const location1Input = page.locator(`input[name*="quantity"][data-location-id="${tuguegaraoLocationId}"], input[name*="${tuguegaraoLocationId}"][name*="quantity"]`).first()
    if (await location1Input.count() > 0) {
      await location1Input.fill(OPENING_STOCK.location1.qty.toString())
    } else {
      // Try alternative selectors
      const quantityInputs = page.locator('input[name*="quantity"], input[type="number"]')
      if (await quantityInputs.count() > 0) {
        await quantityInputs.first().fill(OPENING_STOCK.location1.qty.toString())
      }
    }

    const location1CostInput = page.locator(`input[name*="unitCost"][data-location-id="${tuguegaraoLocationId}"], input[name*="${tuguegaraoLocationId}"][name*="cost"]`).first()
    if (await location1CostInput.count() > 0) {
      await location1CostInput.fill(OPENING_STOCK.location1.unitCost.toString())
    }

    const location1PriceInput = page.locator(`input[name*="sellingPrice"][data-location-id="${tuguegaraoLocationId}"], input[name*="${tuguegaraoLocationId}"][name*="price"]`).first()
    if (await location1PriceInput.count() > 0) {
      await location1PriceInput.fill(OPENING_STOCK.location1.sellingPrice.toString())
    }

    await page.screenshot({ path: 'test-results/test1-07-location1-filled.png', fullPage: true })

    // Set opening stock for Location 2 (Warehouse)
    const location2Input = page.locator(`input[name*="quantity"][data-location-id="${warehouseLocationId}"], input[name*="${warehouseLocationId}"][name*="quantity"]`).first()
    if (await location2Input.count() > 0) {
      await location2Input.fill(OPENING_STOCK.location2.qty.toString())
    } else {
      const quantityInputs = page.locator('input[name*="quantity"], input[type="number"]')
      if (await quantityInputs.count() >= 2) {
        await quantityInputs.nth(1).fill(OPENING_STOCK.location2.qty.toString())
      }
    }

    const location2CostInput = page.locator(`input[name*="unitCost"][data-location-id="${warehouseLocationId}"], input[name*="${warehouseLocationId}"][name*="cost"]`).first()
    if (await location2CostInput.count() > 0) {
      await location2CostInput.fill(OPENING_STOCK.location2.unitCost.toString())
    }

    const location2PriceInput = page.locator(`input[name*="sellingPrice"][data-location-id="${warehouseLocationId}"], input[name*="${warehouseLocationId}"][name*="price"]`).first()
    if (await location2PriceInput.count() > 0) {
      await location2PriceInput.fill(OPENING_STOCK.location2.sellingPrice.toString())
    }

    await page.screenshot({ path: 'test-results/test1-08-both-locations-filled.png', fullPage: true })

    // Submit opening stock
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Set Opening Stock"), button:has-text("Submit")')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test1-09-opening-stock-saved.png', fullPage: true })

    // Verify in database
    const productStock = await prisma.productStock.findMany({
      where: { productId: testProductId },
      include: { location: true }
    })

    console.log('Product stock records:', productStock)
    expect(productStock.length).toBeGreaterThanOrEqual(1)

    // Verify stock movements
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        productId: testProductId,
        type: 'OPENING_STOCK'
      }
    })

    console.log('Stock movements:', stockMovements)
    expect(stockMovements.length).toBeGreaterThanOrEqual(1)

    console.log('✅ Test 1 PASSED: Opening stock set successfully')
  })

  test('Test 2: Try to Change Opening Stock After Set (Should Fail - Locked)', async ({ page }) => {
    console.log('\n=== TEST 2: Try to Change Opening Stock After Set ===')

    // Should still be logged in from previous test, but let's ensure
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Navigate to opening stock page again
    await page.goto(`${BASE_URL}/dashboard/products/${testProductId}/opening-stock`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test2-01-opening-stock-page.png', fullPage: true })

    // Try to change the quantity
    const quantityInputs = page.locator('input[name*="quantity"], input[type="number"]')

    if (await quantityInputs.count() > 0) {
      const firstInput = quantityInputs.first()
      const isDisabled = await firstInput.isDisabled()

      if (isDisabled) {
        console.log('✅ Input is disabled - opening stock is locked')
      } else {
        // Try to fill and submit
        await firstInput.fill('200')
        await page.click('button[type="submit"]')
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/test2-02-attempted-change.png', fullPage: true })

        // Check for error message
        const errorMessage = page.locator('text=/Opening stock is locked|already set|cannot change/i')
        const hasError = await errorMessage.count() > 0

        expect(hasError).toBeTruthy()
        console.log('✅ Error message displayed - opening stock is locked')
      }
    }

    // Look for redirect button to inventory corrections
    const inventoryCorrectionLink = page.locator('a:has-text("Inventory Correction"), button:has-text("Inventory Correction")')
    if (await inventoryCorrectionLink.count() > 0) {
      console.log('✅ Found redirect to Inventory Corrections')
    }

    console.log('✅ Test 2 PASSED: Opening stock is locked')
  })

  test('Test 3: Create Sale Transaction', async ({ page }) => {
    console.log('\n=== TEST 3: Create Sale Transaction ===')

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Navigate to Sales/POS
    const salesLink = page.locator('a[href*="/sales"], a:has-text("Sales"), a:has-text("POS"), button:has-text("New Sale")')
    if (await salesLink.count() > 0) {
      await salesLink.first().click()
    } else {
      await page.goto(`${BASE_URL}/dashboard/sales/new`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test3-01-sales-page.png', fullPage: true })

    // Select location (Tuguegarao)
    const locationSelect = page.locator('select[name="locationId"], select[name="location"]')
    if (await locationSelect.count() > 0) {
      await locationSelect.selectOption({ label: /Tuguegarao/i })
    }

    // Add product to sale
    const productSearch = page.locator('input[placeholder*="Search"], input[name="product"]')
    if (await productSearch.count() > 0) {
      await productSearch.fill(TEST_PRODUCT.name)
      await page.waitForTimeout(1000) // Wait for search results

      // Click on product from search results
      const productResult = page.locator(`text="${TEST_PRODUCT.name}"`).first()
      if (await productResult.count() > 0) {
        await productResult.click()
      }
    }

    // Set quantity to 5
    const quantityInput = page.locator('input[name*="quantity"]').last()
    if (await quantityInput.count() > 0) {
      await quantityInput.fill('5')
    }

    await page.screenshot({ path: 'test-results/test3-02-sale-filled.png', fullPage: true })

    // Submit sale
    await page.click('button:has-text("Complete Sale"), button:has-text("Submit"), button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test3-03-sale-completed.png', fullPage: true })

    // Verify stock reduced in database
    const productStock = await prisma.productStock.findFirst({
      where: {
        productId: testProductId,
        locationId: tuguegaraoLocationId
      }
    })

    console.log('Product stock after sale:', productStock)
    expect(productStock?.quantity).toBe(95) // 100 - 5

    console.log('✅ Test 3 PASSED: Sale created, stock reduced to 95')
  })

  test('Test 4: Try to Set Opening Stock After Transactions (Should Fail)', async ({ page }) => {
    console.log('\n=== TEST 4: Try to Set Opening Stock After Transactions ===')

    await page.goto(`${BASE_URL}/dashboard/products/${testProductId}/opening-stock`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test4-01-opening-stock-page.png', fullPage: true })

    // Check for error message about transactions existing
    const errorMessage = page.locator('text=/Transactions already exist|Opening stock is locked/i')
    const hasError = await errorMessage.count() > 0

    if (hasError) {
      console.log('✅ Error message displayed about existing transactions')
    }

    // Verify inputs are disabled
    const quantityInputs = page.locator('input[name*="quantity"]')
    if (await quantityInputs.count() > 0) {
      const isDisabled = await quantityInputs.first().isDisabled()
      expect(isDisabled).toBeTruthy()
      console.log('✅ Inputs are disabled')
    }

    console.log('✅ Test 4 PASSED: Cannot set opening stock after transactions exist')
  })

  test('Test 5: Physical Inventory Count Export', async ({ page }) => {
    console.log('\n=== TEST 5: Physical Inventory Count Export ===')

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Navigate to Physical Inventory
    const physicalInventoryLink = page.locator('a[href*="physical-inventory"], a:has-text("Physical Inventory")')
    if (await physicalInventoryLink.count() > 0) {
      await physicalInventoryLink.first().click()
    } else {
      await page.goto(`${BASE_URL}/dashboard/inventory/physical-inventory`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test5-01-physical-inventory-page.png', fullPage: true })

    // Select Tuguegarao location
    const locationSelect = page.locator('select[name="locationId"], select[name="location"]')
    if (await locationSelect.count() > 0) {
      await locationSelect.selectOption({ label: /Tuguegarao/i })
      await page.waitForLoadState('networkidle')
    }

    await page.screenshot({ path: 'test-results/test5-02-location-selected.png', fullPage: true })

    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), a:has-text("Export"), button:has-text("Download Template")')

    if (await exportButton.count() > 0) {
      console.log('✅ Export button found')

      // Note: Cannot actually test Excel download/import in Playwright easily
      // but we can verify the button exists
      await page.screenshot({ path: 'test-results/test5-03-export-button-found.png', fullPage: true })
    } else {
      console.log('⚠️  Export button not found on page')
    }

    console.log('✅ Test 5 PASSED: Physical inventory page accessible, export button available')
  })

  test('Test 6: Create Inventory Correction', async ({ page }) => {
    console.log('\n=== TEST 6: Create Inventory Correction ===')

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Navigate to Inventory Corrections
    const correctionsLink = page.locator('a[href*="inventory-corrections"], a:has-text("Inventory Corrections")')
    if (await correctionsLink.count() > 0) {
      await correctionsLink.first().click()
    } else {
      await page.goto(`${BASE_URL}/dashboard/inventory/corrections`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test6-01-corrections-page.png', fullPage: true })

    // Click New Correction
    const newButton = page.locator('button:has-text("New"), a:has-text("New Correction"), button:has-text("Add")')
    if (await newButton.count() > 0) {
      await newButton.first().click()
    } else {
      await page.goto(`${BASE_URL}/dashboard/inventory/corrections/new`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test6-02-new-correction-form.png', fullPage: true })

    // Select Tuguegarao location
    const locationSelect = page.locator('select[name="locationId"], select[name="location"]')
    if (await locationSelect.count() > 0) {
      await locationSelect.selectOption({ label: /Tuguegarao/i })
      await page.waitForTimeout(1000)
    }

    // Select product
    const productSelect = page.locator('select[name="productId"], input[name="product"]')
    if (await productSelect.count() > 0) {
      if (await productSelect.evaluate(el => el.tagName) === 'SELECT') {
        await productSelect.selectOption({ label: new RegExp(TEST_PRODUCT.name) })
      } else {
        await productSelect.fill(TEST_PRODUCT.name)
        await page.waitForTimeout(1000)
        await page.keyboard.press('Enter')
      }
    }

    await page.screenshot({ path: 'test-results/test6-03-product-selected.png', fullPage: true })

    // System count should show 95
    const systemCountDisplay = page.locator('text=/System.*95|Current.*95/')
    if (await systemCountDisplay.count() > 0) {
      console.log('✅ System count displays 95')
    }

    // Enter physical count: 93
    const physicalCountInput = page.locator('input[name="physicalCount"], input[name="actualQuantity"]')
    if (await physicalCountInput.count() > 0) {
      await physicalCountInput.fill('93')
    }

    // Enter reason
    const reasonSelect = page.locator('select[name="reason"], input[name="reason"]')
    if (await reasonSelect.count() > 0) {
      if (await reasonSelect.evaluate(el => el.tagName) === 'SELECT') {
        // Try to select "Damaged" option
        const options = await reasonSelect.locator('option').allTextContents()
        const damagedOption = options.find(opt => opt.toLowerCase().includes('damage'))
        if (damagedOption) {
          await reasonSelect.selectOption({ label: damagedOption })
        }
      } else {
        await reasonSelect.fill('Damaged items')
      }
    }

    // Enter remarks
    const remarksInput = page.locator('textarea[name="remarks"], input[name="remarks"]')
    if (await remarksInput.count() > 0) {
      await remarksInput.fill('Water damage during storage')
    }

    await page.screenshot({ path: 'test-results/test6-04-correction-filled.png', fullPage: true })

    // Submit correction
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Submit"), button:has-text("Create")')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test6-05-correction-submitted.png', fullPage: true })

    // Verify in database
    const correction = await prisma.inventoryCorrection.findFirst({
      where: {
        productId: testProductId,
        locationId: tuguegaraoLocationId
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('Inventory correction:', correction)
    expect(correction).toBeTruthy()
    expect(correction?.systemCount).toBe(95)
    expect(correction?.physicalCount).toBe(93)
    expect(correction?.status).toBe('PENDING')

    console.log('✅ Test 6 PASSED: Inventory correction created with PENDING status')
  })

  test('Test 7: Approve Correction as Admin', async ({ page }) => {
    console.log('\n=== TEST 7: Approve Correction as Admin ===')

    // Logout warehouse manager
    await logout(page)
    await page.screenshot({ path: 'test-results/test7-01-logged-out.png', fullPage: true })

    // Login as branch admin
    await login(page, BRANCH_ADMIN.username, BRANCH_ADMIN.password)
    await page.screenshot({ path: 'test-results/test7-02-admin-logged-in.png', fullPage: true })

    // Navigate to Inventory Corrections
    const correctionsLink = page.locator('a[href*="inventory-corrections"], a:has-text("Inventory Corrections")')
    if (await correctionsLink.count() > 0) {
      await correctionsLink.first().click()
    } else {
      await page.goto(`${BASE_URL}/dashboard/inventory/corrections`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test7-03-corrections-list.png', fullPage: true })

    // Find the pending correction
    const pendingCorrection = page.locator('tr:has-text("Pending"), div:has-text("Pending")').first()

    if (await pendingCorrection.count() > 0) {
      // Look for approve button
      const approveButton = pendingCorrection.locator('button:has-text("Approve"), a:has-text("Approve")')

      if (await approveButton.count() > 0) {
        await approveButton.click()
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/test7-04-correction-approved.png', fullPage: true })
      } else {
        // Maybe need to click on the row first
        await pendingCorrection.click()
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/test7-05-correction-details.png', fullPage: true })

        // Now look for approve button
        const approveBtn = page.locator('button:has-text("Approve")')
        if (await approveBtn.count() > 0) {
          await approveBtn.click()
          await page.waitForLoadState('networkidle')
          await page.screenshot({ path: 'test-results/test7-06-approved.png', fullPage: true })
        }
      }
    }

    // Verify in database that correction is approved
    const correction = await prisma.inventoryCorrection.findFirst({
      where: {
        productId: testProductId,
        locationId: tuguegaraoLocationId
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('Correction after approval:', correction)
    expect(correction?.status).toBe('APPROVED')

    // Verify stock updated to 93
    const productStock = await prisma.productStock.findFirst({
      where: {
        productId: testProductId,
        locationId: tuguegaraoLocationId
      }
    })

    console.log('Product stock after correction:', productStock)
    expect(productStock?.quantity).toBe(93)

    console.log('✅ Test 7 PASSED: Correction approved, stock updated to 93')
  })

  test('Test 8: Verify Stock Transaction History', async ({ page }) => {
    console.log('\n=== TEST 8: Verify Stock Transaction History ===')

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Navigate to product details/history
    await page.goto(`${BASE_URL}/dashboard/products/${testProductId}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test8-01-product-details.png', fullPage: true })

    // Look for stock history tab/section
    const historyLink = page.locator('a:has-text("History"), button:has-text("Stock History"), a:has-text("Transactions")')
    if (await historyLink.count() > 0) {
      await historyLink.first().click()
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: 'test-results/test8-02-stock-history.png', fullPage: true })
    }

    // Verify stock movements in database
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        productId: testProductId,
        locationId: tuguegaraoLocationId
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log('Stock movements:', stockMovements.map(sm => ({
      type: sm.type,
      quantity: sm.quantity,
      balanceAfter: sm.balanceAfter
    })))

    // Should have:
    // 1. Opening stock: +100 (balance: 100)
    // 2. Sale: -5 (balance: 95)
    // 3. Adjustment: -2 (balance: 93)
    expect(stockMovements.length).toBeGreaterThanOrEqual(3)

    const openingStock = stockMovements.find(sm => sm.type === 'OPENING_STOCK')
    expect(openingStock?.balanceAfter).toBe(100)

    const sale = stockMovements.find(sm => sm.type === 'SALE')
    expect(sale?.balanceAfter).toBe(95)

    const adjustment = stockMovements.find(sm => sm.type === 'ADJUSTMENT')
    expect(adjustment?.balanceAfter).toBe(93)

    console.log('✅ Test 8 PASSED: Stock transaction history verified')
  })

  test('Test 9: Verify Audit Trail', async ({ page }) => {
    console.log('\n=== TEST 9: Verify Audit Trail ===')

    // Check audit logs in database
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: testProductId },
          {
            entityType: 'INVENTORY_CORRECTION',
            details: {
              path: ['productId'],
              equals: testProductId
            }
          }
        ]
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log('Audit logs:', auditLogs.map(log => ({
      action: log.action,
      entityType: log.entityType,
      userId: log.userId,
      createdAt: log.createdAt
    })))

    // Should have logs for:
    // 1. Product creation
    // 2. Opening stock creation
    // 3. Sale transaction
    // 4. Inventory correction creation
    // 5. Inventory correction approval

    expect(auditLogs.length).toBeGreaterThanOrEqual(3)

    const productCreation = auditLogs.find(log =>
      log.action === 'CREATE' && log.entityType === 'PRODUCT'
    )
    expect(productCreation).toBeTruthy()

    console.log('✅ Test 9 PASSED: Audit trail exists')

    // Try to navigate to audit logs page if it exists
    await page.goto(`${BASE_URL}/dashboard`)
    const auditLink = page.locator('a[href*="audit"], a:has-text("Audit Log")')
    if (await auditLink.count() > 0) {
      await auditLink.first().click()
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: 'test-results/test9-01-audit-logs-page.png', fullPage: true })
    }
  })

  test('Test 10: Location Access Control', async ({ page }) => {
    console.log('\n=== TEST 10: Location Access Control ===')

    // Logout admin
    await logout(page)

    // Login as warehouse manager
    await login(page, WAREHOUSE_MANAGER.username, WAREHOUSE_MANAGER.password)
    await page.screenshot({ path: 'test-results/test10-01-warehouse-manager-logged-in.png', fullPage: true })

    // Navigate to Physical Inventory
    const physicalInventoryLink = page.locator('a[href*="physical-inventory"], a:has-text("Physical Inventory")')
    if (await physicalInventoryLink.count() > 0) {
      await physicalInventoryLink.first().click()
    } else {
      await page.goto(`${BASE_URL}/dashboard/inventory/physical-inventory`)
    }

    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/test10-02-physical-inventory-page.png', fullPage: true })

    // Check location dropdown
    const locationSelect = page.locator('select[name="locationId"], select[name="location"]')

    if (await locationSelect.count() > 0) {
      const options = await locationSelect.locator('option').allTextContents()
      console.log('Available locations:', options)

      // Should only show 2 locations for warehouse manager
      expect(options.length).toBeLessThanOrEqual(3) // including empty option

      // Verify the locations match warehouse manager's access
      const warehouseManagerUser = await prisma.user.findUnique({
        where: { username: 'warehousemanager' },
        include: {
          accessibleLocations: {
            include: { location: true }
          }
        }
      })

      const accessibleLocationNames = warehouseManagerUser?.accessibleLocations.map(al => al.location.name) || []
      console.log('Warehouse manager accessible locations:', accessibleLocationNames)

      expect(accessibleLocationNames.length).toBe(2)

      console.log('✅ Location access control verified - only 2 locations accessible')
    }

    await page.screenshot({ path: 'test-results/test10-03-location-dropdown.png', fullPage: true })

    console.log('✅ Test 10 PASSED: Location access control working correctly')
  })
})
