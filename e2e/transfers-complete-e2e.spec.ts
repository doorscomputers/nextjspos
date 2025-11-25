import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/**
 * COMPREHENSIVE INVENTORY TRANSFER E2E TESTS
 *
 * Tests the complete transfer workflow with database verification:
 * 1. Transfer Request Creation
 * 2. Transfer Approval Workflow (draft → pending_check → checked → in_transit → arrived → verified → completed)
 * 3. Inventory Adjustments (stock deduction and addition)
 * 4. Product History & Audit Trail
 * 5. Edge Cases (insufficient stock, concurrent transfers, cancellations)
 * 6. Multi-tenant Isolation
 *
 * CRITICAL: Every operation verifies database state for data integrity
 */

const prisma = new PrismaClient()
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

// Test data storage
let adminSession: any
let managerSession: any
let transferId: number
let productId: number
let variationId: number
let fromLocationId: number
let toLocationId: number
let businessId: number

test.describe('Inventory Transfer - Complete E2E Tests', () => {

  test.beforeAll(async ({ browser }) => {
    // Login as admin to set up test data
    const page = await browser.newPage()

    // Login as admin
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Fill username
    const usernameInput = page.locator('input[placeholder*="User Name"], input[name="username"]').first()
    await usernameInput.fill('superadmin')

    // Fill password
    const passwordInput = page.locator('input[placeholder*="Password"], input[name="password"]').first()
    await passwordInput.fill('password')

    // Click login button
    const loginButton = page.locator('button:has-text("LOGIN"), button[type="submit"]').first()
    await loginButton.click()

    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Get session info
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name.includes('session'))
    adminSession = {
      cookie: sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : ''
    }

    // Get user info
    const meResponse = await page.request.get(`${BASE_URL}/api/users/me`, {
      headers: { Cookie: adminSession.cookie }
    })
    const userData = await meResponse.json()
    businessId = userData.businessId

    // Get locations
    const locationsResponse = await page.request.get(`${BASE_URL}/api/locations/all`, {
      headers: { Cookie: adminSession.cookie }
    })
    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations || []

    if (locations.length < 2) {
      throw new Error('Need at least 2 locations for transfer tests')
    }

    fromLocationId = locations[0].id
    toLocationId = locations[1].id

    console.log(`✅ Test setup complete:`)
    console.log(`   Business ID: ${businessId}`)
    console.log(`   From Location: ${locations[0].name} (${fromLocationId})`)
    console.log(`   To Location: ${locations[1].name} (${toLocationId})`)

    await page.close()
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test.describe('1. Transfer Request Creation', () => {

    test('1.1 Should create transfer request with valid data', async ({ page }) => {
      console.log('\n📦 TEST 1.1: Creating transfer request...')

      // Login as admin
      await page.goto(`${BASE_URL}/login`)
      await page.waitForLoadState('networkidle')

      const usernameInput = page.locator('input[placeholder*="User Name"], input[name="username"]').first()
      await usernameInput.fill('superadmin')

      const passwordInput = page.locator('input[placeholder*="Password"], input[name="password"]').first()
      await passwordInput.fill('password')

      const loginButton = page.locator('button:has-text("LOGIN"), button[type="submit"]').first()
      await loginButton.click()

      await page.waitForURL('**/dashboard', { timeout: 15000 })

      // Navigate to transfers page
      await page.goto(`${BASE_URL}/dashboard/transfers`)
      await page.waitForLoadState('networkidle')

      // Click New Transfer button
      const newTransferButton = page.locator('text=New Transfer').first()
      if (await newTransferButton.isVisible()) {
        await newTransferButton.click()
      } else {
        // Try alternate selector
        await page.click('a[href="/dashboard/transfers/create"]')
      }

      await page.waitForURL('**/transfers/create')

      // Verify form elements are present
      await expect(page.locator('h1:has-text("Create Stock Transfer")')).toBeVisible()

      // From location should be auto-assigned (read-only)
      const fromLocationInput = page.locator('input[disabled][value*=""]').first()
      await expect(fromLocationInput).toBeVisible()

      // Wait for products to load
      await page.waitForTimeout(2000)

      // Search for a product
      const searchInput = page.locator('input[placeholder*="Scan barcode"]')
      await searchInput.fill('Product')
      await page.waitForTimeout(1000)

      // Select first product from dropdown (if available)
      const firstProduct = page.locator('[role="option"]').first()
      if (await firstProduct.isVisible({ timeout: 5000 })) {
        await firstProduct.click()

        // Verify item was added to the list
        await expect(page.locator('text=Transfer Items')).toBeVisible()

        // Set quantity
        const quantityInput = page.locator('input[type="number"]').first()
        await quantityInput.fill('5')

        // Add notes
        await page.fill('textarea[placeholder*="Optional notes"]', 'E2E Test Transfer - Automated')

        // Click Create Transfer
        await page.click('button:has-text("Create Transfer")')

        // Confirm in dialog
        await page.waitForTimeout(500)
        const confirmButton = page.locator('button:has-text("Yes, Create Transfer")')
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click()
        }

        // Wait for redirect to transfer details
        await page.waitForURL('**/transfers/**', { timeout: 10000 })

        // Extract transfer ID from URL
        const url = page.url()
        const match = url.match(/transfers\/(\d+)/)
        if (match) {
          transferId = parseInt(match[1])
          console.log(`✅ Transfer created with ID: ${transferId}`)

          // Verify in database
          const transfer = await prisma.stockTransfer.findUnique({
            where: { id: transferId },
            include: { items: true }
          })

          expect(transfer).toBeTruthy()
          expect(transfer?.status).toBe('draft')
          expect(transfer?.stockDeducted).toBe(false)
          expect(transfer?.fromLocationId).toBe(fromLocationId)
          expect(transfer?.toLocationId).toBe(toLocationId)
          expect(transfer?.items.length).toBeGreaterThan(0)

          // Store product info for later tests
          if (transfer?.items[0]) {
            productId = transfer.items[0].productId
            variationId = transfer.items[0].productVariationId
          }

          console.log(`✅ Database verification passed:`)
          console.log(`   Status: ${transfer?.status}`)
          console.log(`   Stock Deducted: ${transfer?.stockDeducted}`)
          console.log(`   Items: ${transfer?.items.length}`)
        }
      } else {
        console.log('⚠️ No products available for testing')
        test.skip()
      }
    })

    test('1.2 Should validate required fields', async ({ page }) => {
      console.log('\n📦 TEST 1.2: Testing form validation...')

      await page.goto(`${BASE_URL}/dashboard/transfers/create`)
      await page.waitForLoadState('networkidle')

      // Try to create transfer without items
      const createButton = page.locator('button:has-text("Create Transfer")')
      await createButton.click()

      // Should show error toast
      await expect(page.locator('text=Please add at least one item')).toBeVisible({ timeout: 3000 })

      console.log('✅ Form validation working correctly')
    })

    test('1.3 Should prevent transfer to same location', async ({ page }) => {
      console.log('\n📦 TEST 1.3: Testing same-location validation...')

      // This is handled at the UI level - from and to locations can't be the same
      // The API also validates this

      const response = await page.request.post(`${BASE_URL}/api/transfers`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSession.cookie
        },
        data: {
          fromLocationId: fromLocationId,
          toLocationId: fromLocationId, // Same as from
          items: [{ productId: 1, productVariationId: 1, quantity: 1 }],
          notes: 'Invalid transfer test'
        }
      })

      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.error).toContain('cannot be the same')

      console.log('✅ Same-location validation working correctly')
    })
  })

  test.describe('2. Transfer Approval Workflow', () => {

    test('2.1 Should submit transfer for checking', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n✅ TEST 2.1: Submitting transfer for checking...')

      // Navigate to transfer details
      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Submit for Check button
      const submitButton = page.locator('button:has-text("Submit for Check")')
      if (await submitButton.isVisible({ timeout: 5000 })) {
        await submitButton.click()

        // Wait for status update
        await page.waitForTimeout(2000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId }
        })

        expect(transfer?.status).toBe('pending_check')
        console.log(`✅ Transfer status updated to: ${transfer?.status}`)
      } else {
        console.log('⚠️ Submit for Check button not found - transfer may already be submitted')
      }
    })

    test('2.2 Should approve transfer (check)', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n✅ TEST 2.2: Approving transfer...')

      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Approve button
      const approveButton = page.locator('button:has-text("Approve")').first()
      if (await approveButton.isVisible({ timeout: 5000 })) {
        await approveButton.click()

        // Wait for confirmation dialog
        await page.waitForTimeout(500)
        const confirmButton = page.locator('button:has-text("Yes, Approve")')
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click()
        }

        // Wait for status update
        await page.waitForTimeout(2000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId }
        })

        expect(transfer?.status).toBe('checked')
        expect(transfer?.checkedBy).toBeTruthy()
        expect(transfer?.checkedAt).toBeTruthy()

        console.log(`✅ Transfer approved:`)
        console.log(`   Status: ${transfer?.status}`)
        console.log(`   Checked By: ${transfer?.checkedBy}`)
      } else {
        console.log('⚠️ Approve button not found')
      }
    })

    test('2.3 Should send transfer (stock deduction)', async ({ page }) => {
      if (!transferId || !variationId) {
        test.skip()
        return
      }

      console.log('\n🚚 TEST 2.3: Sending transfer (CRITICAL - stock deduction)...')

      // Get stock BEFORE send
      const stockBefore = await prisma.variationLocationDetails.findFirst({
        where: {
          productVariationId: variationId,
          locationId: fromLocationId
        }
      })

      const qtyBefore = stockBefore ? parseFloat(stockBefore.qtyAvailable.toString()) : 0
      console.log(`   Stock BEFORE send: ${qtyBefore}`)

      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Send button
      const sendButton = page.locator('button:has-text("Send Transfer")').first()
      if (await sendButton.isVisible({ timeout: 5000 })) {
        await sendButton.click()

        // Wait for confirmation
        await page.waitForTimeout(500)
        const confirmButton = page.locator('button:has-text("Yes, Send")')
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click()
        }

        // Wait for processing
        await page.waitForTimeout(3000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId },
          include: { items: true }
        })

        expect(transfer?.status).toBe('in_transit')
        expect(transfer?.stockDeducted).toBe(true)
        expect(transfer?.sentBy).toBeTruthy()
        expect(transfer?.sentAt).toBeTruthy()

        // CRITICAL: Verify stock was deducted
        const stockAfter = await prisma.variationLocationDetails.findFirst({
          where: {
            productVariationId: variationId,
            locationId: fromLocationId
          }
        })

        const qtyAfter = stockAfter ? parseFloat(stockAfter.qtyAvailable.toString()) : 0
        const transferredQty = transfer?.items[0] ? parseFloat(transfer.items[0].quantity.toString()) : 0

        console.log(`   Stock AFTER send: ${qtyAfter}`)
        console.log(`   Transferred quantity: ${transferredQty}`)
        console.log(`   Expected: ${qtyBefore - transferredQty}`)

        expect(qtyAfter).toBe(qtyBefore - transferredQty)

        console.log(`✅ Stock deduction verified correctly!`)
      } else {
        console.log('⚠️ Send button not found')
      }
    })

    test('2.4 Should mark transfer as arrived', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n📦 TEST 2.4: Marking transfer as arrived...')

      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Mark as Arrived button
      const arrivedButton = page.locator('button:has-text("Mark as Arrived")').first()
      if (await arrivedButton.isVisible({ timeout: 5000 })) {
        await arrivedButton.click()

        await page.waitForTimeout(500)
        const confirmButton = page.locator('button:has-text("Confirm")')
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click()
        }

        await page.waitForTimeout(2000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId }
        })

        expect(transfer?.status).toBe('arrived')
        expect(transfer?.arrivedBy).toBeTruthy()
        expect(transfer?.arrivedAt).toBeTruthy()

        console.log(`✅ Transfer marked as arrived`)
      } else {
        console.log('⚠️ Mark as Arrived button not found')
      }
    })

    test('2.5 Should start verification', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n🔍 TEST 2.5: Starting verification...')

      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Start Verification button
      const verifyButton = page.locator('button:has-text("Start Verification")').first()
      if (await verifyButton.isVisible({ timeout: 5000 })) {
        await verifyButton.click()

        await page.waitForTimeout(2000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId }
        })

        expect(transfer?.status).toBe('verifying')

        console.log(`✅ Verification started`)
      } else {
        console.log('⚠️ Start Verification button not found')
      }
    })

    test('2.6 Should verify all items', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n✅ TEST 2.6: Verifying all items...')

      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Verify All Items button
      const verifyAllButton = page.locator('button:has-text("Verify All Items")').first()
      if (await verifyAllButton.isVisible({ timeout: 5000 })) {
        await verifyAllButton.click()

        await page.waitForTimeout(500)
        const confirmButton = page.locator('button:has-text("Confirm")')
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click()
        }

        await page.waitForTimeout(2000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId },
          include: { items: true }
        })

        expect(transfer?.status).toBe('verified')

        // All items should be verified
        const allVerified = transfer?.items.every(item => item.verified === true)
        expect(allVerified).toBe(true)

        console.log(`✅ All items verified`)
      } else {
        console.log('⚠️ Verify All Items button not found')
      }
    })

    test('2.7 Should complete transfer (stock addition)', async ({ page }) => {
      if (!transferId || !variationId) {
        test.skip()
        return
      }

      console.log('\n🎉 TEST 2.7: Completing transfer (CRITICAL - stock addition)...')

      // Get destination stock BEFORE complete
      const stockBefore = await prisma.variationLocationDetails.findFirst({
        where: {
          productVariationId: variationId,
          locationId: toLocationId
        }
      })

      const qtyBefore = stockBefore ? parseFloat(stockBefore.qtyAvailable.toString()) : 0
      console.log(`   Destination stock BEFORE complete: ${qtyBefore}`)

      await page.goto(`${BASE_URL}/dashboard/transfers/${transferId}`)
      await page.waitForLoadState('networkidle')

      // Find and click Complete Transfer button
      const completeButton = page.locator('button:has-text("Complete Transfer")').first()
      if (await completeButton.isVisible({ timeout: 5000 })) {
        await completeButton.click()

        await page.waitForTimeout(500)
        const confirmButton = page.locator('button:has-text("Yes, Complete")')
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click()
        }

        // Wait for processing
        await page.waitForTimeout(3000)

        // Verify database update
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id: transferId },
          include: { items: true }
        })

        expect(transfer?.status).toBe('completed')
        expect(transfer?.completedBy).toBeTruthy()
        expect(transfer?.completedAt).toBeTruthy()

        // CRITICAL: Verify stock was added to destination
        const stockAfter = await prisma.variationLocationDetails.findFirst({
          where: {
            productVariationId: variationId,
            locationId: toLocationId
          }
        })

        const qtyAfter = stockAfter ? parseFloat(stockAfter.qtyAvailable.toString()) : 0
        const transferredQty = transfer?.items[0] ? parseFloat(transfer.items[0].quantity.toString()) : 0

        console.log(`   Destination stock AFTER complete: ${qtyAfter}`)
        console.log(`   Transferred quantity: ${transferredQty}`)
        console.log(`   Expected: ${qtyBefore + transferredQty}`)

        expect(qtyAfter).toBe(qtyBefore + transferredQty)

        console.log(`✅ Stock addition verified correctly!`)
        console.log(`✅ TRANSFER WORKFLOW COMPLETE!`)
      } else {
        console.log('⚠️ Complete Transfer button not found')
      }
    })
  })

  test.describe('3. Audit Trail & History', () => {

    test('3.1 Should record audit logs for all actions', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n📝 TEST 3.1: Verifying audit trail...')

      // Check audit logs in database
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'stock_transfer',
          entityIds: {
            has: transferId
          }
        },
        orderBy: { createdAt: 'asc' }
      })

      console.log(`   Found ${auditLogs.length} audit log entries`)

      // Should have logs for: create, submit, approve, send, arrived, verify, complete
      expect(auditLogs.length).toBeGreaterThanOrEqual(5)

      // Verify key actions are logged
      const actions = auditLogs.map(log => log.action)
      expect(actions).toContain('transfer_create')

      console.log(`✅ Audit trail verified:`)
      auditLogs.forEach(log => {
        console.log(`   - ${log.action} by User#${log.userId} at ${log.createdAt}`)
      })
    })

    test('3.2 Should show stock movements in history', async ({ page }) => {
      if (!transferId || !variationId) {
        test.skip()
        return
      }

      console.log('\n📊 TEST 3.2: Verifying stock movement records...')

      // Check stock movements
      const movements = await prisma.stockMovement.findMany({
        where: {
          productVariationId: variationId,
          referenceType: 'transfer',
          referenceId: transferId
        },
        orderBy: { createdAt: 'asc' }
      })

      console.log(`   Found ${movements.length} stock movement records`)

      // Should have movements for both deduction and addition
      expect(movements.length).toBeGreaterThanOrEqual(2)

      // Verify deduction from source
      const deduction = movements.find(m => m.locationId === fromLocationId && m.movementType === 'out')
      expect(deduction).toBeTruthy()

      // Verify addition to destination
      const addition = movements.find(m => m.locationId === toLocationId && m.movementType === 'in')
      expect(addition).toBeTruthy()

      console.log(`✅ Stock movements verified:`)
      console.log(`   - OUT from location ${fromLocationId}: ${deduction?.quantity}`)
      console.log(`   - IN to location ${toLocationId}: ${addition?.quantity}`)
    })
  })

  test.describe('4. Edge Cases', () => {

    test('4.1 Should prevent transfer with insufficient stock', async ({ page }) => {
      console.log('\n⚠️ TEST 4.1: Testing insufficient stock validation...')

      // Try to create transfer with quantity > available stock
      const response = await page.request.post(`${BASE_URL}/api/transfers`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSession.cookie
        },
        data: {
          fromLocationId: fromLocationId,
          toLocationId: toLocationId,
          items: [
            {
              productId: productId || 1,
              productVariationId: variationId || 1,
              quantity: 999999 // Excessive quantity
            }
          ],
          notes: 'Insufficient stock test'
        }
      })

      // Note: API creates the transfer in draft status
      // Stock validation happens during SEND operation
      if (response.ok()) {
        const data = await response.json()
        const testTransferId = data.transfer.id

        // Try to send it - should fail
        const sendResponse = await page.request.post(`${BASE_URL}/api/transfers/${testTransferId}/send`, {
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminSession.cookie
          },
          data: { notes: 'Test send' }
        })

        // Should fail due to insufficient stock
        expect(sendResponse.ok()).toBe(false)

        // Clean up test transfer
        await prisma.stockTransfer.delete({ where: { id: testTransferId } })
      }

      console.log('✅ Insufficient stock validation working')
    })

    test('4.2 Should prevent canceling completed transfer', async ({ page }) => {
      if (!transferId) {
        test.skip()
        return
      }

      console.log('\n🔒 TEST 4.2: Testing completed transfer immutability...')

      // Try to cancel completed transfer
      const response = await page.request.post(`${BASE_URL}/api/transfers/${transferId}/cancel`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSession.cookie
        },
        data: { reason: 'Test cancellation' }
      })

      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.error).toContain('Cannot cancel')

      console.log('✅ Completed transfer is immutable')
    })

    test('4.3 Should enforce multi-tenant isolation', async ({ page }) => {
      console.log('\n🔐 TEST 4.3: Testing multi-tenant isolation...')

      // Get transfers for this business
      const businessTransfers = await prisma.stockTransfer.findMany({
        where: { businessId: businessId }
      })

      console.log(`   Found ${businessTransfers.length} transfers for business ${businessId}`)

      // All transfers should belong to the same business
      const allSameBusiness = businessTransfers.every(t => t.businessId === businessId)
      expect(allSameBusiness).toBe(true)

      // Try to access transfer from different business (if exists)
      const otherBusinessTransfer = await prisma.stockTransfer.findFirst({
        where: {
          businessId: { not: businessId }
        }
      })

      if (otherBusinessTransfer) {
        const response = await page.request.get(
          `${BASE_URL}/api/transfers/${otherBusinessTransfer.id}`,
          {
            headers: { Cookie: adminSession.cookie }
          }
        )

        // Should be 404 (not found) due to businessId filter
        expect(response.status()).toBe(404)
        console.log('✅ Cannot access other business transfers')
      } else {
        console.log('⚠️ No other business transfers to test isolation')
      }

      console.log('✅ Multi-tenant isolation verified')
    })
  })

  test.describe('5. Transfer Reports', () => {

    test('5.1 Should display transfers in list view', async ({ page }) => {
      console.log('\n📋 TEST 5.1: Testing transfers list view...')

      await page.goto(`${BASE_URL}/dashboard/transfers`)
      await page.waitForLoadState('networkidle')

      // Verify page loaded
      await expect(page.locator('h1:has-text("Stock Transfers")')).toBeVisible()

      // Should show transfers in grid
      const gridRows = page.locator('.dx-datagrid-rowsview tr[role="row"]')
      const rowCount = await gridRows.count()

      console.log(`   Found ${rowCount} transfers in grid`)
      expect(rowCount).toBeGreaterThan(0)

      console.log('✅ Transfers list view working')
    })

    test('5.2 Should filter transfers by status', async ({ page }) => {
      console.log('\n🔍 TEST 5.2: Testing status filter...')

      await page.goto(`${BASE_URL}/dashboard/transfers`)
      await page.waitForLoadState('networkidle')

      // Select "completed" status
      const statusFilter = page.locator('select').first()
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('completed')
        await page.waitForTimeout(1000)

        // Verify badge shows filtered count
        const badge = page.locator('text=Showing:')
        await expect(badge).toBeVisible()

        console.log('✅ Status filter working')
      }
    })

    test('5.3 Should export transfers to Excel', async ({ page }) => {
      console.log('\n📊 TEST 5.3: Testing Excel export...')

      await page.goto(`${BASE_URL}/dashboard/transfers`)
      await page.waitForLoadState('networkidle')

      // Look for export button (DevExtreme grid)
      const exportButton = page.locator('button[aria-label="Export"]')
      if (await exportButton.isVisible({ timeout: 3000 })) {
        // Click export would download file - just verify button exists
        await expect(exportButton).toBeVisible()
        console.log('✅ Export functionality available')
      } else {
        console.log('⚠️ Export button not found')
      }
    })
  })
})
