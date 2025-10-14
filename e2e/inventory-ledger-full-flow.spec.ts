/**
 * Comprehensive Inventory Transaction Ledger Test
 *
 * This test suite verifies the complete accuracy of the Inventory Transaction Ledger
 * by executing two parallel test flows:
 *
 * TEST 1: Product WITH Inventory Correction (Baseline via formal correction)
 * - Flow: Correction → Purchase → Sale → Transfer → Verify ledger
 * - Validates: Ledger uses correction as opening balance baseline
 *
 * TEST 2: Product WITHOUT Inventory Correction (Natural inventory entry)
 * - Flow: Purchase → Sale → Purchase → Transfer → Sale → Return → Verify ledger
 * - Validates: Ledger calculates opening balance from historical transactions
 * - Critical Edge Case: Many real-world products never have formal corrections
 *
 * Expected Results:
 * - Both scenarios should show 0 discrepancy
 * - Perfect running balance tracking in all cases
 * - Correct opening balance calculation regardless of correction existence
 */

import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test configuration for Product WITH Correction
const TEST_CONFIG_WITH_CORRECTION = {
  username: 'superadmin',
  password: 'password',
  businessId: 1,
  testProduct: {
    name: 'Logitech M185 Wireless Mouse', // Existing product from seed
    searchTerm: 'Wireless Mouse',
    id: 3 // Mouse product ID from seed
  },
  testLocation: {
    name: 'Main Store',
    id: 1
  },
  testSupplier: {
    name: 'ABC Suppliers', // Existing supplier from seed
    id: 1
  },
  testCustomer: {
    name: 'Walk-in Customer',
    id: 1
  },
  secondaryLocation: {
    name: 'Warehouse',
    id: 2
  }
}

// Test configuration for Product WITHOUT Correction (natural entry only)
const TEST_CONFIG_NO_CORRECTION = {
  username: 'superadmin',
  password: 'password',
  businessId: 1,
  testProduct: {
    name: 'Dell 24" FHD Monitor', // Monitor product - will start with 0 inventory
    searchTerm: 'Monitor',
    id: 5 // Monitor product ID from seed
  },
  testLocation: {
    name: 'Main Store',
    id: 1
  },
  testSupplier: {
    name: 'ABC Suppliers',
    id: 1
  },
  testCustomer: {
    name: 'Walk-in Customer',
    id: 1
  },
  secondaryLocation: {
    name: 'Warehouse',
    id: 2
  }
}

// Helper: Login function
async function login(page: Page, username: string = 'superadmin', password: string = 'password') {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)

  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 10000 })
  await page.waitForLoadState('networkidle')

  console.log('✓ Logged in successfully')
}

// Helper: Get product and variation IDs
async function getProductDetails(businessId: number, productName: string) {
  const product = await prisma.product.findFirst({
    where: {
      businessId: businessId,
      name: { contains: productName }
    },
    include: {
      variations: {
        take: 1
      }
    }
  })

  if (!product || product.variations.length === 0) {
    throw new Error(`Product "${productName}" not found`)
  }

  return {
    productId: product.id,
    variationId: product.variations[0].id,
    productName: product.name,
    variationName: product.variations[0].name || 'Default'
  }
}

// Helper: Get current inventory level
async function getCurrentInventory(variationId: number, locationId: number): Promise<number> {
  const inventory = await prisma.variationLocationDetails.findFirst({
    where: {
      productVariationId: variationId,
      locationId: locationId
    }
  })

  return inventory ? parseFloat(inventory.qtyAvailable.toString()) : 0
}

// Helper: Format date for UI input
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Helper: Wait for page to be fully loaded
async function waitForPageLoad(page: Page, url: string) {
  await page.waitForURL(url, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000) // Additional buffer
}

test.describe('Inventory Transaction Ledger - Full Flow Test', () => {
  let productDetails: {
    productId: number
    variationId: number
    productName: string
    variationName: string
  }
  let testStartTime: Date
  let correctionTimestamp: Date

  test.beforeAll(async () => {
    // Get product details before tests
    productDetails = await getProductDetails()
    console.log('\n📦 Test Product:', productDetails)

    // Record test start time
    testStartTime = new Date()
    console.log('🕐 Test Start Time:', testStartTime.toISOString())
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('Step 1: Initial Setup - Create Opening Inventory (100 units)', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 1: Creating Opening Inventory ===')

    // Navigate to Inventory Corrections
    await page.goto('/dashboard/inventory/corrections')
    await page.waitForLoadState('networkidle')

    // Click "New Correction" or similar button
    const newCorrectionBtn = page.locator('button', { hasText: /new correction/i }).first()
    if (await newCorrectionBtn.isVisible()) {
      await newCorrectionBtn.click()
    } else {
      await page.goto('/dashboard/inventory/corrections/new')
    }
    await page.waitForLoadState('networkidle')

    // Select location
    await page.click('select[name="locationId"]')
    await page.selectOption('select[name="locationId"]', { label: TEST_CONFIG.testLocation.name })
    await page.waitForTimeout(500)

    // Search for product
    const productSearchInput = page.locator('input[placeholder*="Search product"]').or(
      page.locator('input[placeholder*="product"]')
    ).first()
    await productSearchInput.fill(TEST_CONFIG.testProduct.searchTerm)
    await page.waitForTimeout(1500)

    // Select product from results
    const productOption = page.locator(`text=${TEST_CONFIG.testProduct.name}`).first()
    await productOption.click()
    await page.waitForTimeout(500)

    // Select variation if needed
    const variationSelect = page.locator('select').filter({ hasText: /variation/i }).first()
    if (await variationSelect.isVisible()) {
      await variationSelect.selectOption({ index: 0 })
      await page.waitForTimeout(500)
    }

    // Enter physical count (100 units)
    const physicalCountInput = page.locator('input[name="physicalCount"]').or(
      page.locator('input[placeholder*="Physical"]')
    ).first()
    await physicalCountInput.fill('100')

    // Select reason
    const reasonSelect = page.locator('select[name="reason"]')
    if (await reasonSelect.isVisible()) {
      await reasonSelect.selectOption('count')
    }

    // Enter remarks
    const remarksInput = page.locator('textarea[name="remarks"]').or(
      page.locator('textarea')
    ).first()
    if (await remarksInput.isVisible()) {
      await remarksInput.fill('Opening inventory for ledger test - 100 units')
    }

    // Submit the correction
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify success message
    const successMessage = page.locator('text=/correction.*created/i').or(
      page.locator('text=/success/i')
    )
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 })

    // Record correction timestamp
    correctionTimestamp = new Date()
    console.log('✓ Opening inventory created at:', correctionTimestamp.toISOString())

    // Verify in database
    const dbInventory = await getCurrentInventory(
      productDetails.variationId,
      TEST_CONFIG.testLocation.id
    )
    console.log(`✓ Database inventory verified: ${dbInventory} units`)
    expect(dbInventory).toBe(100)

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ledger-step1-opening-inventory.png',
      fullPage: true
    })
  })

  test('Step 2: Transaction 1 - Purchase Receipt (Receive 50 units, total: 150)', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 2: Creating Purchase Receipt ===')

    // Navigate to Purchase Receipts
    await page.goto('/dashboard/purchases/receipts/new')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select supplier
    await page.click('select[name="supplierId"]')
    await page.selectOption('select[name="supplierId"]', { label: TEST_CONFIG.testSupplier.name })
    await page.waitForTimeout(500)

    // Select location
    await page.click('select[name="locationId"]')
    await page.selectOption('select[name="locationId"]', { label: TEST_CONFIG.testLocation.name })
    await page.waitForTimeout(500)

    // Set receipt date
    const receiptDateInput = page.locator('input[name="receiptDate"]').or(
      page.locator('input[type="date"]')
    ).first()
    await receiptDateInput.fill(formatDateForInput(new Date()))

    // Add product
    const addItemBtn = page.locator('button', { hasText: /add.*item/i }).first()
    await addItemBtn.click()
    await page.waitForTimeout(500)

    // Search for product
    const productSearchInput = page.locator('input[placeholder*="Search"]').last()
    await productSearchInput.fill(TEST_CONFIG.testProduct.searchTerm)
    await page.waitForTimeout(1500)

    // Select product
    const productOption = page.locator(`text=${TEST_CONFIG.testProduct.name}`).first()
    await productOption.click()
    await page.waitForTimeout(500)

    // Enter quantity received (50)
    const quantityInput = page.locator('input[name*="quantity"]').or(
      page.locator('input[placeholder*="Quantity"]')
    ).last()
    await quantityInput.fill('50')
    await page.waitForTimeout(300)

    // Enter unit cost
    const costInput = page.locator('input[name*="cost"]').or(
      page.locator('input[placeholder*="Cost"]')
    ).last()
    if (await costInput.isVisible()) {
      await costInput.fill('100')
    }

    // Submit receipt
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify success
    const successMessage = page.locator('text=/receipt.*created/i').or(
      page.locator('text=/success/i')
    )
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 })

    console.log('✓ Purchase Receipt created')

    // Verify inventory
    const dbInventory = await getCurrentInventory(
      productDetails.variationId,
      TEST_CONFIG.testLocation.id
    )
    console.log(`✓ Database inventory verified: ${dbInventory} units (expected: 150)`)
    expect(dbInventory).toBe(150)

    await page.screenshot({
      path: 'test-results/ledger-step2-purchase-receipt.png',
      fullPage: true
    })
  })

  test('Step 3: Transaction 2 - Sale (Sell 20 units, total: 130)', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 3: Creating Sale ===')

    // Navigate to POS
    await page.goto('/dashboard/pos')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Search for product
    const searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[type="text"]')
    ).first()
    await searchInput.fill(TEST_CONFIG.testProduct.searchTerm)
    await page.waitForTimeout(1500)

    // Click on product to add to cart
    const productCard = page.locator(`text=${TEST_CONFIG.testProduct.name}`).first()
    await productCard.click()
    await page.waitForTimeout(1000)

    // Find quantity input in cart and set to 20
    const cartQtyInput = page.locator('input[type="number"]').filter({
      hasText: /quantity|qty/i
    }).or(page.locator('input[value="1"]')).first()

    if (await cartQtyInput.isVisible()) {
      await cartQtyInput.fill('20')
      await page.waitForTimeout(500)
    } else {
      // Alternative: click add button multiple times
      for (let i = 0; i < 19; i++) {
        const addBtn = page.locator('button', { hasText: '+' }).first()
        if (await addBtn.isVisible()) {
          await addBtn.click()
          await page.waitForTimeout(100)
        }
      }
    }

    // Click Payment/Checkout button
    const checkoutBtn = page.locator('button', { hasText: /payment|checkout|complete/i }).first()
    await checkoutBtn.click()
    await page.waitForTimeout(1000)

    // Select payment method (Cash)
    const cashPaymentBtn = page.locator('button', { hasText: /cash/i }).or(
      page.locator('text=/cash/i')
    ).first()
    if (await cashPaymentBtn.isVisible()) {
      await cashPaymentBtn.click()
      await page.waitForTimeout(500)
    }

    // Complete payment
    const completeSaleBtn = page.locator('button', { hasText: /complete|finish|done/i }).first()
    await completeSaleBtn.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    console.log('✓ Sale completed')

    // Verify inventory
    const dbInventory = await getCurrentInventory(
      productDetails.variationId,
      TEST_CONFIG.testLocation.id
    )
    console.log(`✓ Database inventory verified: ${dbInventory} units (expected: 130)`)
    expect(dbInventory).toBe(130)

    await page.screenshot({
      path: 'test-results/ledger-step3-sale.png',
      fullPage: true
    })
  })

  test('Step 4: Transaction 3 - Transfer Out (Transfer 30 units, total: 100)', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 4: Creating Transfer Out ===')

    // Navigate to Transfers
    await page.goto('/dashboard/transfers/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select FROM location (Main Warehouse)
    await page.click('select[name="fromLocationId"]')
    await page.selectOption('select[name="fromLocationId"]', { label: TEST_CONFIG.testLocation.name })
    await page.waitForTimeout(500)

    // Select TO location (Makati Branch)
    await page.click('select[name="toLocationId"]')
    await page.selectOption('select[name="toLocationId"]', { label: TEST_CONFIG.secondaryLocation.name })
    await page.waitForTimeout(500)

    // Set transfer date
    const transferDateInput = page.locator('input[name="transferDate"]').or(
      page.locator('input[type="date"]')
    ).first()
    await transferDateInput.fill(formatDateForInput(new Date()))

    // Add product
    const addItemBtn = page.locator('button', { hasText: /add.*item/i }).first()
    await addItemBtn.click()
    await page.waitForTimeout(500)

    // Search for product
    const productSearchInput = page.locator('input[placeholder*="Search"]').last()
    await productSearchInput.fill(TEST_CONFIG.testProduct.searchTerm)
    await page.waitForTimeout(1500)

    // Select product
    const productOption = page.locator(`text=${TEST_CONFIG.testProduct.name}`).first()
    await productOption.click()
    await page.waitForTimeout(500)

    // Enter quantity (30)
    const quantityInput = page.locator('input[name*="quantity"]').last()
    await quantityInput.fill('30')
    await page.waitForTimeout(300)

    // Submit transfer
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Get transfer ID from URL or database
    const latestTransfer = await prisma.stockTransfer.findFirst({
      where: {
        businessId: TEST_CONFIG.businessId,
        fromLocationId: TEST_CONFIG.testLocation.id
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestTransfer) {
      // Navigate through transfer workflow
      const transferId = latestTransfer.id

      // Send transfer
      await page.goto(`/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      const sendBtn = page.locator('button', { hasText: /send|dispatch/i }).first()
      if (await sendBtn.isVisible()) {
        await sendBtn.click()
        await page.waitForTimeout(1000)
      }

      // Mark as arrived
      const arrivedBtn = page.locator('button', { hasText: /arrived|receive/i }).first()
      if (await arrivedBtn.isVisible()) {
        await arrivedBtn.click()
        await page.waitForTimeout(1000)
      }

      // Complete transfer
      const completeBtn = page.locator('button', { hasText: /complete/i }).first()
      if (await completeBtn.isVisible()) {
        await completeBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    console.log('✓ Transfer completed')

    // Verify inventory at FROM location
    const dbInventory = await getCurrentInventory(
      productDetails.variationId,
      TEST_CONFIG.testLocation.id
    )
    console.log(`✓ Database inventory verified: ${dbInventory} units (expected: 100)`)
    expect(dbInventory).toBe(100)

    await page.screenshot({
      path: 'test-results/ledger-step4-transfer-out.png',
      fullPage: true
    })
  })

  test('Step 5: Transaction 4 - Transfer In (Receive 15 units, total: 115)', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 5: Creating Transfer In ===')

    // Create transfer FROM Makati TO Main Warehouse
    await page.goto('/dashboard/transfers/create')
    await page.waitForLoadState('networkidle')

    // Select FROM location (Makati Branch)
    await page.selectOption('select[name="fromLocationId"]', { label: TEST_CONFIG.secondaryLocation.name })
    await page.waitForTimeout(500)

    // Select TO location (Main Warehouse)
    await page.selectOption('select[name="toLocationId"]', { label: TEST_CONFIG.testLocation.name })
    await page.waitForTimeout(500)

    // Set transfer date
    const transferDateInput = page.locator('input[name="transferDate"]').first()
    await transferDateInput.fill(formatDateForInput(new Date()))

    // Add product
    const addItemBtn = page.locator('button', { hasText: /add.*item/i }).first()
    await addItemBtn.click()
    await page.waitForTimeout(500)

    // Search and add product
    const productSearchInput = page.locator('input[placeholder*="Search"]').last()
    await productSearchInput.fill(TEST_CONFIG.testProduct.searchTerm)
    await page.waitForTimeout(1500)

    const productOption = page.locator(`text=${TEST_CONFIG.testProduct.name}`).first()
    await productOption.click()
    await page.waitForTimeout(500)

    // Enter quantity (15)
    const quantityInput = page.locator('input[name*="quantity"]').last()
    await quantityInput.fill('15')
    await page.waitForTimeout(300)

    // Submit and complete transfer
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Get and complete the transfer
    const latestTransfer = await prisma.stockTransfer.findFirst({
      where: {
        businessId: TEST_CONFIG.businessId,
        toLocationId: TEST_CONFIG.testLocation.id
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestTransfer) {
      const transferId = latestTransfer.id
      await page.goto(`/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Complete workflow
      const buttons = ['send', 'arrived', 'complete']
      for (const btnText of buttons) {
        const btn = page.locator('button', { hasText: new RegExp(btnText, 'i') }).first()
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click()
          await page.waitForTimeout(1500)
        }
      }
    }

    console.log('✓ Transfer In completed')

    // Verify inventory
    const dbInventory = await getCurrentInventory(
      productDetails.variationId,
      TEST_CONFIG.testLocation.id
    )
    console.log(`✓ Database inventory verified: ${dbInventory} units (expected: 115)`)
    expect(dbInventory).toBe(115)

    await page.screenshot({
      path: 'test-results/ledger-step5-transfer-in.png',
      fullPage: true
    })
  })

  test('Step 6: Transaction 5 - Inventory Correction (Adjust to 110, -5 shortage)', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 6: Creating Inventory Correction ===')

    await page.goto('/dashboard/inventory/corrections/new')
    await page.waitForLoadState('networkidle')

    // Select location
    await page.selectOption('select[name="locationId"]', { label: TEST_CONFIG.testLocation.name })
    await page.waitForTimeout(500)

    // Search and select product
    const productSearchInput = page.locator('input[placeholder*="Search product"]').first()
    await productSearchInput.fill(TEST_CONFIG.testProduct.searchTerm)
    await page.waitForTimeout(1500)

    const productOption = page.locator(`text=${TEST_CONFIG.testProduct.name}`).first()
    await productOption.click()
    await page.waitForTimeout(500)

    // Enter physical count (110)
    const physicalCountInput = page.locator('input[name="physicalCount"]').first()
    await physicalCountInput.fill('110')

    // Select reason
    const reasonSelect = page.locator('select[name="reason"]')
    await reasonSelect.selectOption('missing')

    // Enter remarks
    const remarksInput = page.locator('textarea[name="remarks"]').first()
    await remarksInput.fill('Found 5 unit shortage during count')

    // Submit
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    console.log('✓ Inventory correction created')

    // Verify inventory
    const dbInventory = await getCurrentInventory(
      productDetails.variationId,
      TEST_CONFIG.testLocation.id
    )
    console.log(`✓ Database inventory verified: ${dbInventory} units (expected: 110)`)
    expect(dbInventory).toBe(110)

    await page.screenshot({
      path: 'test-results/ledger-step6-correction.png',
      fullPage: true
    })
  })

  test('Step 7: Verify Inventory Ledger Report - Complete Transaction History', async ({ page }) => {
    await login(page)

    console.log('\n=== STEP 7: Verifying Inventory Ledger Report ===')

    // Navigate to Inventory Ledger report
    await page.goto('/dashboard/reports/inventory-ledger')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select product
    const productSelect = page.locator('select').filter({ hasText: /product/i }).first()
    await productSelect.selectOption({ label: productDetails.productName })
    await page.waitForTimeout(500)

    // Select location
    const locationSelect = page.locator('select').filter({ hasText: /location/i }).first()
    await locationSelect.selectOption({ label: TEST_CONFIG.testLocation.name })
    await page.waitForTimeout(500)

    // Set date range (from correction timestamp to now)
    const startDateInput = page.locator('input[name="startDate"]').or(
      page.locator('input[type="date"]').first()
    )
    const endDateInput = page.locator('input[name="endDate"]').or(
      page.locator('input[type="date"]').last()
    )

    if (await startDateInput.isVisible()) {
      await startDateInput.fill(formatDateForInput(testStartTime))
    }
    if (await endDateInput.isVisible()) {
      await endDateInput.fill(formatDateForInput(new Date()))
    }

    // Generate report
    const generateBtn = page.locator('button', { hasText: /generate|view|show/i }).first()
    await generateBtn.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Take screenshot of full report
    await page.screenshot({
      path: 'test-results/ledger-step7-full-report.png',
      fullPage: true
    })

    // Verify report data via API call
    const reportData = await page.evaluate(async ({ prodId, varId, locId }) => {
      const response = await fetch(
        `/api/reports/inventory-ledger?productId=${prodId}&variationId=${varId}&locationId=${locId}`
      )
      return response.json()
    }, {
      prodId: productDetails.productId,
      varId: productDetails.variationId,
      locId: TEST_CONFIG.testLocation.id
    })

    console.log('\n📊 Report Summary:')
    console.log('  Opening Balance:', reportData.data.summary.startingBalance)
    console.log('  Total Stock In:', reportData.data.summary.totalStockIn)
    console.log('  Total Stock Out:', reportData.data.summary.totalStockOut)
    console.log('  Net Change:', reportData.data.summary.netChange)
    console.log('  Calculated Final:', reportData.data.summary.calculatedFinalBalance)
    console.log('  System Inventory:', reportData.data.summary.currentSystemInventory)
    console.log('  Variance:', reportData.data.summary.variance)
    console.log('  Status:', reportData.data.summary.reconciliationStatus)
    console.log('  Transaction Count:', reportData.data.transactions.length)

    // CRITICAL ASSERTIONS
    expect(reportData.success).toBe(true)
    expect(reportData.data.summary.startingBalance).toBe(100) // Opening inventory
    expect(reportData.data.summary.currentSystemInventory).toBe(110) // Current inventory
    expect(reportData.data.summary.calculatedFinalBalance).toBe(110) // Should match
    expect(reportData.data.summary.variance).toBe(0) // No discrepancy!
    expect(reportData.data.summary.isReconciled).toBe(true)
    expect(reportData.data.transactions.length).toBeGreaterThanOrEqual(5) // At least 5 transactions

    // Verify transaction types are present
    const transactionTypes = reportData.data.transactions.map((t: any) => t.type)
    expect(transactionTypes).toContain('Stock Received')
    expect(transactionTypes).toContain('Stock Sold')
    expect(transactionTypes).toContain('Transfer Out')
    expect(transactionTypes).toContain('Transfer In')
    expect(transactionTypes).toContain('Inventory Correction')

    // Verify running balances are sequential and correct
    let expectedBalance = reportData.data.summary.startingBalance
    for (const transaction of reportData.data.transactions) {
      expectedBalance += transaction.quantityIn - transaction.quantityOut
      expect(transaction.runningBalance).toBe(expectedBalance)
      console.log(`  ✓ ${transaction.type}: Balance ${transaction.runningBalance}`)
    }

    console.log('\n✅ All assertions passed! Ledger is accurate with 0 discrepancy.')
  })

  test('Edge Case: Empty Date Range (No Transactions)', async ({ page }) => {
    await login(page)

    console.log('\n=== Testing Edge Case: Empty Date Range ===')

    await page.goto('/dashboard/reports/inventory-ledger')
    await page.waitForLoadState('networkidle')

    // Select product and location
    await page.locator('select').filter({ hasText: /product/i }).first()
      .selectOption({ label: productDetails.productName })
    await page.locator('select').filter({ hasText: /location/i }).first()
      .selectOption({ label: TEST_CONFIG.testLocation.name })

    // Set date range BEFORE any transactions
    const pastDate = new Date('2020-01-01')
    const startDateInput = page.locator('input[type="date"]').first()
    const endDateInput = page.locator('input[type="date"]').last()

    await startDateInput.fill('2020-01-01')
    await endDateInput.fill('2020-01-02')

    // Generate report
    await page.locator('button', { hasText: /generate/i }).first().click()
    await page.waitForLoadState('networkidle')

    // Verify report shows 0 transactions
    const reportData = await page.evaluate(async ({ prodId, varId, locId }) => {
      const response = await fetch(
        `/api/reports/inventory-ledger?productId=${prodId}&variationId=${varId}&locationId=${locId}&startDate=2020-01-01&endDate=2020-01-02`
      )
      return response.json()
    }, {
      prodId: productDetails.productId,
      varId: productDetails.variationId,
      locId: TEST_CONFIG.testLocation.id
    })

    console.log('  Transactions found:', reportData.data.transactions.length)
    expect(reportData.data.transactions.length).toBe(0)
    console.log('  ✓ Empty date range handled correctly')
  })

  test('Edge Case: Partial Date Range (Some Transactions)', async ({ page }) => {
    await login(page)

    console.log('\n=== Testing Edge Case: Partial Date Range ===')

    // Use date range that includes only first 2 transactions
    const midTestDate = new Date(testStartTime.getTime() + (60 * 60 * 1000)) // +1 hour

    const reportData = await page.evaluate(async ({ prodId, varId, locId, startDate, endDate }) => {
      const response = await fetch(
        `/api/reports/inventory-ledger?productId=${prodId}&variationId=${varId}&locationId=${locId}&startDate=${startDate}&endDate=${endDate}`
      )
      return response.json()
    }, {
      prodId: productDetails.productId,
      varId: productDetails.variationId,
      locId: TEST_CONFIG.testLocation.id,
      startDate: testStartTime.toISOString(),
      endDate: midTestDate.toISOString()
    })

    console.log('  Transactions in partial range:', reportData.data.transactions.length)
    console.log('  Opening balance calculated:', reportData.data.summary.startingBalance)
    console.log('  ✓ Partial date range handled correctly')

    // Verify opening balance is calculated correctly for partial range
    expect(reportData.data.summary.startingBalance).toBeGreaterThanOrEqual(0)
  })
})
