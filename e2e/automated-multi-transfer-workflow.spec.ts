import { test, expect, Page, Browser } from '@playwright/test'

/**
 * ✨ AUTOMATED MULTI-LOCATION TRANSFER WORKFLOW TEST
 *
 * This test automates the COMPLETE transfer workflow with multiple users and locations:
 *
 * Flow:
 * 1. warehouse_clerk    → Creates 2 transfers (Main Warehouse → Main Store & Main Warehouse → Bambang)
 * 2. warehouse_supervisor → Approves both transfers
 * 3. warehouse_manager  → Sends both transfers (stock deducted from Main Warehouse)
 * 4. mainstore_receiver → Receives transfer at Main Store (stock added)
 * 5. bambang_receiver   → Receives transfer at Bambang (stock added)
 * 6. Verify inventory is correct at all 3 locations
 *
 * Products:
 * - Transfer 1: Product 1 (5 units) → Main Store
 * - Transfer 2: Product 2 (3 units) → Bambang
 *
 * All users use password: "password"
 */

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

// Test data
let transfer1Id: number
let transfer2Id: number
let product1Id: number
let product2Id: number
let variation1Id: number
let variation2Id: number
let mainWarehouseId: number
let mainStoreId: number
let bambangId: number

// Helper function: Login as user
async function loginAs(page: Page, username: string) {
  console.log(`\n🔑 Logging in as: ${username}`)
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[name="username"]', { timeout: 10000 })
  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 30000 })
  await page.waitForLoadState('networkidle')
  console.log(`✅ Logged in as ${username}`)
}

// Helper function: Logout
async function logout(page: Page) {
  console.log('🚪 Logging out...')
  // Look for logout button or user menu
  const userMenuButton = page.locator('button:has-text("User"), button:has-text("Profile"), [aria-label="User menu"]').first()
  if (await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await userMenuButton.click()
    await page.waitForTimeout(500)
  }

  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out")').first()
  if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutButton.click()
    await page.waitForURL('**/login', { timeout: 10000 })
    console.log('✅ Logged out')
  } else {
    // Fallback: clear cookies and go to login
    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/login`)
    console.log('✅ Logged out (fallback)')
  }
}

// Helper function: Get stock quantity via API
async function getStockQuantity(page: Page, variationId: number, locationId: number): Promise<number> {
  const response = await page.request.get(`${BASE_URL}/api/products/stock?variationId=${variationId}&locationId=${locationId}`)
  const data = await response.json()
  return parseFloat(data.qtyAvailable || 0)
}

test.describe('Automated Multi-Location Transfer Workflow', () => {

  test.beforeAll(async ({ browser }) => {
    console.log('\n🔧 Setting up test environment...')
    const page = await browser.newPage()

    // Login as admin to get initial data
    await loginAs(page, 'admin')

    // Get locations
    const locationsResponse = await page.request.get(`${BASE_URL}/api/locations`)
    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations

    if (!locations || locations.length < 3) {
      throw new Error('Need at least 3 locations. Please run: npm run db:seed')
    }

    // Find specific locations by name
    mainWarehouseId = locations.find((l: any) => l.name.includes('Warehouse'))?.id || locations[0].id
    mainStoreId = locations.find((l: any) => l.name.includes('Main Store'))?.id || locations[1].id
    bambangId = locations.find((l: any) => l.name.includes('Bambang'))?.id || locations[2].id

    console.log(`📍 Main Warehouse ID: ${mainWarehouseId}`)
    console.log(`📍 Main Store ID: ${mainStoreId}`)
    console.log(`📍 Bambang ID: ${bambangId}`)

    // Get products
    const productsResponse = await page.request.get(`${BASE_URL}/api/products`)
    const productsData = await productsResponse.json()
    const products = productsData.products

    if (!products || products.length < 2) {
      throw new Error('Need at least 2 products. Please run: npm run db:seed')
    }

    product1Id = products[0].id
    variation1Id = products[0].variations[0].id
    product2Id = products[1].id
    variation2Id = products[1].variations[0].id

    console.log(`📦 Product 1: ${products[0].name} (ID: ${product1Id})`)
    console.log(`📦 Product 2: ${products[1].name} (ID: ${product2Id})`)

    await page.close()
    console.log('✅ Test environment ready!')
  })

  test('Complete automated transfer workflow: Warehouse → 2 Locations', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('🚀 STARTING AUTOMATED TRANSFER WORKFLOW TEST')
    console.log('='.repeat(80))

    // ========================================
    // STEP 1: CREATE TRANSFERS (warehouse_clerk)
    // ========================================
    console.log('\n📝 STEP 1: CREATE TRANSFERS')
    console.log('-'.repeat(80))
    await loginAs(page, 'warehouse_clerk')

    // Navigate to create transfer page
    await page.goto(`${BASE_URL}/dashboard/transfers/create`)
    await page.waitForLoadState('networkidle')

    // Create Transfer 1: Main Warehouse → Main Store
    console.log('\n📋 Creating Transfer 1: Main Warehouse → Main Store')

    // Select destination location
    const toLocationSelect1 = page.locator('select[name="toLocationId"], #toLocationId').first()
    await toLocationSelect1.selectOption({ value: mainStoreId.toString() })
    console.log(`  ✓ Selected destination: Main Store`)

    // Add product 1
    await page.click('button:has-text("Add Product"), button:has-text("Add Item")')
    await page.waitForTimeout(1000)

    const productSelect1 = page.locator('select').filter({ hasText: 'Select Product' }).first()
    await productSelect1.selectOption({ value: product1Id.toString() })
    await page.waitForTimeout(500)

    const variationSelect1 = page.locator('select').filter({ hasText: 'Select Variation' }).first()
    await variationSelect1.selectOption({ value: variation1Id.toString() })
    await page.waitForTimeout(500)

    const quantityInput1 = page.locator('input[type="number"]').filter({ hasText: '' }).first()
    await quantityInput1.fill('5')
    console.log(`  ✓ Added product: 5 units`)

    // Submit transfer 1
    await page.click('button:has-text("Create Transfer"), button[type="submit"]')
    await page.waitForTimeout(2000)

    // Get transfer 1 ID from URL or response
    const url1 = page.url()
    const match1 = url1.match(/transfers\/(\d+)/)
    if (match1) {
      transfer1Id = parseInt(match1[1])
      console.log(`✅ Transfer 1 created: ID ${transfer1Id}`)
    } else {
      // Try to get from transfers list
      await page.goto(`${BASE_URL}/dashboard/transfers`)
      await page.waitForLoadState('networkidle')
      const firstTransferLink = page.locator('a[href*="/dashboard/transfers/"]').first()
      const href = await firstTransferLink.getAttribute('href')
      const idMatch = href?.match(/transfers\/(\d+)/)
      if (idMatch) {
        transfer1Id = parseInt(idMatch[1])
        console.log(`✅ Transfer 1 created: ID ${transfer1Id}`)
      }
    }

    // Create Transfer 2: Main Warehouse → Bambang
    console.log('\n📋 Creating Transfer 2: Main Warehouse → Bambang')
    await page.goto(`${BASE_URL}/dashboard/transfers/create`)
    await page.waitForLoadState('networkidle')

    const toLocationSelect2 = page.locator('select[name="toLocationId"], #toLocationId').first()
    await toLocationSelect2.selectOption({ value: bambangId.toString() })
    console.log(`  ✓ Selected destination: Bambang`)

    await page.click('button:has-text("Add Product"), button:has-text("Add Item")')
    await page.waitForTimeout(1000)

    const productSelect2 = page.locator('select').filter({ hasText: 'Select Product' }).first()
    await productSelect2.selectOption({ value: product2Id.toString() })
    await page.waitForTimeout(500)

    const variationSelect2 = page.locator('select').filter({ hasText: 'Select Variation' }).first()
    await variationSelect2.selectOption({ value: variation2Id.toString() })
    await page.waitForTimeout(500)

    const quantityInput2 = page.locator('input[type="number"]').filter({ hasText: '' }).first()
    await quantityInput2.fill('3')
    console.log(`  ✓ Added product: 3 units`)

    await page.click('button:has-text("Create Transfer"), button[type="submit"]')
    await page.waitForTimeout(2000)

    const url2 = page.url()
    const match2 = url2.match(/transfers\/(\d+)/)
    if (match2) {
      transfer2Id = parseInt(match2[1])
      console.log(`✅ Transfer 2 created: ID ${transfer2Id}`)
    }

    await logout(page)

    // ========================================
    // STEP 2: APPROVE TRANSFERS (warehouse_supervisor)
    // ========================================
    console.log('\n✅ STEP 2: APPROVE TRANSFERS')
    console.log('-'.repeat(80))
    await loginAs(page, 'warehouse_supervisor')

    // Approve Transfer 1
    console.log(`\n🔍 Approving Transfer 1 (ID: ${transfer1Id})`)
    await page.goto(`${BASE_URL}/dashboard/transfers/${transfer1Id}`)
    await page.waitForLoadState('networkidle')

    const approveButton1 = page.locator('button:has-text("Approve"), button:has-text("Check")').first()
    if (await approveButton1.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveButton1.click()
      await page.waitForTimeout(2000)
      console.log(`✅ Transfer 1 approved`)
    } else {
      console.log(`⚠️ Transfer 1 may already be approved or button not found`)
    }

    // Approve Transfer 2
    console.log(`\n🔍 Approving Transfer 2 (ID: ${transfer2Id})`)
    await page.goto(`${BASE_URL}/dashboard/transfers/${transfer2Id}`)
    await page.waitForLoadState('networkidle')

    const approveButton2 = page.locator('button:has-text("Approve"), button:has-text("Check")').first()
    if (await approveButton2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveButton2.click()
      await page.waitForTimeout(2000)
      console.log(`✅ Transfer 2 approved`)
    }

    await logout(page)

    // ========================================
    // STEP 3: SEND TRANSFERS (warehouse_manager)
    // ========================================
    console.log('\n🚚 STEP 3: SEND TRANSFERS (Stock Deducted)')
    console.log('-'.repeat(80))
    await loginAs(page, 'warehouse_manager')

    // Record stock before sending
    const warehouseStock1Before = await getStockQuantity(page, variation1Id, mainWarehouseId)
    const warehouseStock2Before = await getStockQuantity(page, variation2Id, mainWarehouseId)
    console.log(`📊 Main Warehouse stock BEFORE sending:`)
    console.log(`   Product 1: ${warehouseStock1Before} units`)
    console.log(`   Product 2: ${warehouseStock2Before} units`)

    // Send Transfer 1
    console.log(`\n📤 Sending Transfer 1 (ID: ${transfer1Id})`)
    await page.goto(`${BASE_URL}/dashboard/transfers/${transfer1Id}`)
    await page.waitForLoadState('networkidle')

    const sendButton1 = page.locator('button:has-text("Send")').first()
    if (await sendButton1.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendButton1.click()
      await page.waitForTimeout(2000)
      console.log(`✅ Transfer 1 sent - Stock deducted from Main Warehouse`)
    }

    // Send Transfer 2
    console.log(`\n📤 Sending Transfer 2 (ID: ${transfer2Id})`)
    await page.goto(`${BASE_URL}/dashboard/transfers/${transfer2Id}`)
    await page.waitForLoadState('networkidle')

    const sendButton2 = page.locator('button:has-text("Send")').first()
    if (await sendButton2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendButton2.click()
      await page.waitForTimeout(2000)
      console.log(`✅ Transfer 2 sent - Stock deducted from Main Warehouse`)
    }

    // Verify stock deducted
    const warehouseStock1After = await getStockQuantity(page, variation1Id, mainWarehouseId)
    const warehouseStock2After = await getStockQuantity(page, variation2Id, mainWarehouseId)
    console.log(`\n📊 Main Warehouse stock AFTER sending:`)
    console.log(`   Product 1: ${warehouseStock1After} units (expected: ${warehouseStock1Before - 5})`)
    console.log(`   Product 2: ${warehouseStock2After} units (expected: ${warehouseStock2Before - 3})`)

    expect(warehouseStock1After).toBe(warehouseStock1Before - 5)
    expect(warehouseStock2After).toBe(warehouseStock2Before - 3)

    await logout(page)

    // ========================================
    // STEP 4: RECEIVE AT MAIN STORE (mainstore_receiver)
    // ========================================
    console.log('\n📥 STEP 4: RECEIVE TRANSFER AT MAIN STORE')
    console.log('-'.repeat(80))
    await loginAs(page, 'mainstore_receiver')

    const mainStoreStockBefore = await getStockQuantity(page, variation1Id, mainStoreId)
    console.log(`📊 Main Store stock BEFORE receiving: ${mainStoreStockBefore} units`)

    console.log(`\n📦 Receiving Transfer 1 at Main Store (ID: ${transfer1Id})`)
    await page.goto(`${BASE_URL}/dashboard/transfers/${transfer1Id}`)
    await page.waitForLoadState('networkidle')

    const receiveButton1 = page.locator('button:has-text("Receive"), button:has-text("Complete")').first()
    if (await receiveButton1.isVisible({ timeout: 5000 }).catch(() => false)) {
      await receiveButton1.click()
      await page.waitForTimeout(3000)
      console.log(`✅ Transfer 1 received at Main Store`)
    }

    const mainStoreStockAfter = await getStockQuantity(page, variation1Id, mainStoreId)
    console.log(`📊 Main Store stock AFTER receiving: ${mainStoreStockAfter} units (expected: ${mainStoreStockBefore + 5})`)

    expect(mainStoreStockAfter).toBe(mainStoreStockBefore + 5)

    await logout(page)

    // ========================================
    // STEP 5: RECEIVE AT BAMBANG (bambang_receiver)
    // ========================================
    console.log('\n📥 STEP 5: RECEIVE TRANSFER AT BAMBANG')
    console.log('-'.repeat(80))
    await loginAs(page, 'bambang_receiver')

    const bambangStockBefore = await getStockQuantity(page, variation2Id, bambangId)
    console.log(`📊 Bambang stock BEFORE receiving: ${bambangStockBefore} units`)

    console.log(`\n📦 Receiving Transfer 2 at Bambang (ID: ${transfer2Id})`)
    await page.goto(`${BASE_URL}/dashboard/transfers/${transfer2Id}`)
    await page.waitForLoadState('networkidle')

    const receiveButton2 = page.locator('button:has-text("Receive"), button:has-text("Complete")').first()
    if (await receiveButton2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await receiveButton2.click()
      await page.waitForTimeout(3000)
      console.log(`✅ Transfer 2 received at Bambang`)
    }

    const bambangStockAfter = await getStockQuantity(page, variation2Id, bambangId)
    console.log(`📊 Bambang stock AFTER receiving: ${bambangStockAfter} units (expected: ${bambangStockBefore + 3})`)

    expect(bambangStockAfter).toBe(bambangStockBefore + 3)

    await logout(page)

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(80))
    console.log('✅ AUTOMATED TRANSFER WORKFLOW TEST COMPLETE!')
    console.log('='.repeat(80))
    console.log('\n📊 FINAL INVENTORY SUMMARY:')
    console.log(`   Main Warehouse Product 1: ${warehouseStock1Before} → ${warehouseStock1After} (-5) ✅`)
    console.log(`   Main Warehouse Product 2: ${warehouseStock2Before} → ${warehouseStock2After} (-3) ✅`)
    console.log(`   Main Store Product 1: ${mainStoreStockBefore} → ${mainStoreStockAfter} (+5) ✅`)
    console.log(`   Bambang Product 2: ${bambangStockBefore} → ${bambangStockAfter} (+3) ✅`)
    console.log('\n✨ All transfers completed successfully!')
    console.log('✨ All inventory movements verified!')
    console.log('✨ Multi-user workflow tested!')
    console.log('='.repeat(80) + '\n')
  })
})
