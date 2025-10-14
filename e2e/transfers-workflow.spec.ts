import { test, expect, Page } from '@playwright/test'

/**
 * EXHAUSTIVE TRANSFER WORKFLOW TESTS
 *
 * Critical User Requirement:
 * "Money is involved here and they might put me to jail if the app has errors"
 *
 * ZERO TOLERANCE FOR ERRORS - Complete workflow testing
 */

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3009'

let authCookie: string
let businessId: number
let userId: number
let originLocationId: number
let destLocationId: number
let productId: number
let variationId: number

test.describe('Transfer Workflow - EXHAUSTIVE TESTING', () => {
  test.beforeAll(async ({ browser }) => {
    console.log('\n🔧 Setting up test environment...')
    const page = await browser.newPage()

    // Login as branchadmin (has all transfer permissions)
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[name="username"]', { timeout: 10000 })
    await page.fill('input[name="username"]', 'branchadmin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    // Wait for navigation with longer timeout to allow for dashboard compilation
    await page.waitForURL('**/dashboard', { timeout: 30000 })
    await page.waitForLoadState('networkidle')

    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name.includes('session'))
    authCookie = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : ''

    // Get user info from session
    const meResponse = await page.request.get(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: authCookie },
    })
    const sessionData = await meResponse.json()

    if (!sessionData.user) {
      throw new Error('Failed to get user session')
    }

    businessId = parseInt(sessionData.user.businessId)
    userId = parseInt(sessionData.user.id)

    console.log(`✅ Logged in - User ID: ${userId}, Business ID: ${businessId}`)

    // Get locations
    const locationsResponse = await page.request.get(`${BASE_URL}/api/locations`, {
      headers: { Cookie: authCookie },
    })

    if (!locationsResponse.ok()) {
      throw new Error(`Failed to get locations: ${locationsResponse.status()}`)
    }

    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations

    if (!locations || locations.length === 0) {
      throw new Error('No locations found in database. Please run: npm run db:seed')
    }

    originLocationId = locations[0].id
    destLocationId = locations[1]?.id || locations[0].id

    // Get a product with stock
    const productsResponse = await page.request.get(`${BASE_URL}/api/products`, {
      headers: { Cookie: authCookie },
    })

    if (!productsResponse.ok()) {
      throw new Error(`Failed to get products: ${productsResponse.status()}`)
    }

    const products = await productsResponse.json()

    if (!products.products || products.products.length === 0) {
      throw new Error('No products found in database. Please run: npm run db:seed')
    }

    productId = products.products[0].id
    variationId = products.products[0].variations[0].id

    console.log(`  Origin Location: ${originLocationId}`)
    console.log(`  Destination Location: ${destLocationId}`)
    console.log(`  Test Product: ${productId}`)

    await page.close()
  })

  test('TEST 1: Complete workflow - draft → completed', async ({ page }) => {
    console.log('\n📦 TEST 1: Testing complete transfer workflow')

    // Get initial stock at origin
    const initialStockRes = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const initialStock = await initialStockRes.json()
    const initialQtyOrigin = parseFloat(initialStock.quantity || 0)
    console.log(`  Initial stock at origin: ${initialQtyOrigin}`)

    // Get initial stock at destination
    const initialDestStockRes = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${destLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const initialDestStock = await initialDestStockRes.json()
    const initialQtyDest = parseFloat(initialDestStock.quantity || 0)
    console.log(`  Initial stock at destination: ${initialQtyDest}`)

    const transferQty = 5

    // Step 1: Create transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: transferQty }],
        notes: 'Complete workflow test'
      }
    })

    expect(createRes.status()).toBe(201)
    const createData = await createRes.json()
    const transferId = createData.transfer.id

    console.log(`  ✓ Created transfer ${createData.transfer.transferNumber}`)
    expect(createData.transfer.status).toBe('draft')
    expect(createData.transfer.stockDeducted).toBe(false)

    // Step 2: Submit for checking
    const submitRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/submit-for-check`,
      { headers: { Cookie: authCookie }, data: {} }
    )

    expect(submitRes.status()).toBe(200)
    const submitData = await submitRes.json()
    console.log(`  ✓ Submitted for checking`)
    expect(submitData.transfer.status).toBe('pending_check')

    // Step 3: Checker approves
    const approveRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/check-approve`,
      { headers: { Cookie: authCookie }, data: { notes: 'Items verified physically' } }
    )

    expect(approveRes.status()).toBe(200)
    const approveData = await approveRes.json()
    console.log(`  ✓ Checker approved`)
    expect(approveData.transfer.status).toBe('checked')
    expect(approveData.transfer.checkedBy).toBe(userId)
    expect(approveData.transfer.checkedAt).toBeTruthy()

    // Verify stock NOT deducted yet
    const stockAfterApprove = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const qtyAfterApprove = parseFloat((await stockAfterApprove.json()).quantity)
    expect(qtyAfterApprove).toBe(initialQtyOrigin)
    console.log(`  ✓ Stock still at origin: ${qtyAfterApprove} (not deducted yet)`)

    // Step 4: Send transfer - CRITICAL: Stock deduction
    const sendRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/send`,
      { headers: { Cookie: authCookie }, data: { notes: 'Sent to destination' } }
    )

    expect(sendRes.status()).toBe(200)
    const sendData = await sendRes.json()
    console.log(`  ✓ Transfer sent`)
    expect(sendData.transfer.status).toBe('in_transit')
    expect(sendData.transfer.stockDeducted).toBe(true)
    expect(sendData.transfer.sentBy).toBe(userId)

    // CRITICAL: Verify stock deducted from origin
    const stockAfterSend = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const qtyAfterSend = parseFloat((await stockAfterSend.json()).quantity)
    expect(qtyAfterSend).toBe(initialQtyOrigin - transferQty)
    console.log(`  ✓ CRITICAL: Stock deducted from origin: ${qtyAfterSend} (was ${initialQtyOrigin})`)

    // Step 5: Mark arrived
    const arrivedRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/mark-arrived`,
      { headers: { Cookie: authCookie }, data: {} }
    )

    expect(arrivedRes.status()).toBe(200)
    const arrivedData = await arrivedRes.json()
    console.log(`  ✓ Marked as arrived`)
    expect(arrivedData.transfer.status).toBe('arrived')
    expect(arrivedData.transfer.arrivedBy).toBe(userId)

    // Step 6: Start verification
    const verifyStartRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/start-verification`,
      { headers: { Cookie: authCookie } }
    )

    expect(verifyStartRes.status()).toBe(200)
    console.log(`  ✓ Started verification`)

    // Get transfer items
    const transferRes = await page.request.get(
      `${BASE_URL}/api/transfers/${transferId}`,
      { headers: { Cookie: authCookie } }
    )
    const transfer = await transferRes.json()
    const itemId = transfer.items[0].id

    // Step 7: Verify item
    const verifyItemRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/verify-item`,
      {
        headers: { Cookie: authCookie },
        data: {
          itemId,
          receivedQuantity: transferQty,
          hasDiscrepancy: false
        }
      }
    )

    expect(verifyItemRes.status()).toBe(200)
    const verifyItemData = await verifyItemRes.json()
    console.log(`  ✓ Item verified with checkbox`)
    expect(verifyItemData.item.verified).toBe(true)
    expect(verifyItemData.item.verifiedBy).toBe(userId)

    // Verify stock NOT added to destination yet
    const stockBeforeComplete = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${destLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const qtyBeforeComplete = parseFloat((await stockBeforeComplete.json()).quantity || 0)
    expect(qtyBeforeComplete).toBe(initialQtyDest)
    console.log(`  ✓ Stock NOT at destination yet: ${qtyBeforeComplete}`)

    // Step 8: Complete transfer - CRITICAL: Stock addition
    const completeRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/complete`,
      { headers: { Cookie: authCookie }, data: {} }
    )

    expect(completeRes.status()).toBe(200)
    const completeData = await completeRes.json()
    console.log(`  ✓ Transfer completed`)
    expect(completeData.transfer.status).toBe('completed')
    expect(completeData.transfer.completedBy).toBe(userId)

    // CRITICAL: Verify stock added to destination
    const finalDestStock = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${destLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const finalQtyDest = parseFloat((await finalDestStock.json()).quantity)
    expect(finalQtyDest).toBe(initialQtyDest + transferQty)
    console.log(`  ✓ CRITICAL: Stock added to destination: ${finalQtyDest} (was ${initialQtyDest})`)

    // Verify final origin stock
    const finalOriginStock = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const finalQtyOrigin = parseFloat((await finalOriginStock.json()).quantity)
    expect(finalQtyOrigin).toBe(initialQtyOrigin - transferQty)
    console.log(`  ✓ Final origin stock: ${finalQtyOrigin}`)

    console.log(`  ✅ COMPLETE WORKFLOW PASSED - Stock accuracy verified`)
  })

  test('TEST 2: Immutability - completed transfer cannot be modified', async ({ page }) => {
    console.log('\n🔒 TEST 2: Testing immutability of completed transfers')

    // Create and complete a transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: 2 }]
      }
    })
    const transfer = (await createRes.json()).transfer
    const transferId = transfer.id

    // Submit, approve, send, arrive, verify, complete
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/check-approve`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/send`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/mark-arrived`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/start-verification`, { headers: { Cookie: authCookie } })

    const transferData = await (await page.request.get(`${BASE_URL}/api/transfers/${transferId}`, { headers: { Cookie: authCookie } })).json()
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/verify-item`, {
      headers: { Cookie: authCookie },
      data: { itemId: transferData.items[0].id, receivedQuantity: 2 }
    })

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/complete`, { headers: { Cookie: authCookie }, data: {} })

    console.log(`  ✓ Transfer completed`)

    // Try to cancel completed transfer
    const cancelRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/cancel`,
      { headers: { Cookie: authCookie }, data: { reason: 'Test' } }
    )

    expect(cancelRes.status()).toBe(400)
    const error = await cancelRes.json()
    expect(error.error.toLowerCase()).toContain('completed')
    console.log(`  ✓ Cannot cancel completed transfer: ${error.error}`)

    console.log(`  ✅ IMMUTABILITY TEST PASSED`)
  })

  test('TEST 3: Cancellation with stock restoration', async ({ page }) => {
    console.log('\n🔄 TEST 3: Testing cancellation with stock restoration')

    // Get initial stock
    const initialStockRes = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const initialQty = parseFloat((await initialStockRes.json()).quantity)
    console.log(`  Initial stock: ${initialQty}`)

    const transferQty = 3

    // Create and send transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: transferQty }]
      }
    })
    const transferId = (await createRes.json()).transfer.id

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/check-approve`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/send`, { headers: { Cookie: authCookie }, data: {} })

    // Verify stock deducted
    const stockAfterSend = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const qtyAfterSend = parseFloat((await stockAfterSend.json()).quantity)
    expect(qtyAfterSend).toBe(initialQty - transferQty)
    console.log(`  ✓ Stock deducted: ${qtyAfterSend} (was ${initialQty})`)

    // Cancel transfer
    const cancelRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/cancel`,
      { headers: { Cookie: authCookie }, data: { reason: 'Wrong destination' } }
    )

    expect(cancelRes.status()).toBe(200)
    console.log(`  ✓ Transfer cancelled`)

    // CRITICAL: Verify stock restored
    const stockAfterCancel = await page.request.get(
      `${BASE_URL}/api/products/${productId}/stock?locationId=${originLocationId}&variationId=${variationId}`,
      { headers: { Cookie: authCookie } }
    )
    const qtyAfterCancel = parseFloat((await stockAfterCancel.json()).quantity)
    expect(qtyAfterCancel).toBe(initialQty)
    console.log(`  ✓ CRITICAL: Stock restored: ${qtyAfterCancel} (back to ${initialQty})`)

    console.log(`  ✅ CANCELLATION TEST PASSED`)
  })

  test('TEST 4: Checker rejection - return to draft', async ({ page }) => {
    console.log('\n❌ TEST 4: Testing checker rejection')

    // Create and submit transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: 1 }]
      }
    })
    const transferId = (await createRes.json()).transfer.id

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })

    // Checker rejects
    const rejectRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/check-reject`,
      { headers: { Cookie: authCookie }, data: { reason: 'Quantities incorrect' } }
    )

    expect(rejectRes.status()).toBe(200)
    const rejectData = await rejectRes.json()
    expect(rejectData.transfer.status).toBe('draft')
    expect(rejectData.transfer.checkerNotes).toBe('Quantities incorrect')
    console.log(`  ✓ Transfer returned to draft with reason`)

    console.log(`  ✅ REJECTION TEST PASSED`)
  })

  test('TEST 5: Cannot complete with unverified items', async ({ page }) => {
    console.log('\n⚠️ TEST 5: Testing verification requirement')

    // Create transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: 1 }]
      }
    })
    const transferId = (await createRes.json()).transfer.id

    // Move to verifying but don't verify items
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/check-approve`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/send`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/mark-arrived`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/start-verification`, { headers: { Cookie: authCookie } })

    // Try to complete without verifying items
    const completeRes = await page.request.post(
      `${BASE_URL}/api/transfers/${transferId}/complete`,
      { headers: { Cookie: authCookie }, data: {} }
    )

    expect(completeRes.status()).toBe(400)
    const error = await completeRes.json()
    expect(error.error.toLowerCase()).toContain('not verified')
    console.log(`  ✓ Cannot complete: ${error.error}`)

    console.log(`  ✅ VERIFICATION REQUIREMENT TEST PASSED`)
  })

  test('TEST 6: Stock transaction audit trail', async ({ page }) => {
    console.log('\n📋 TEST 6: Testing stock transaction audit trail')

    // Create and complete transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: 4 }]
      }
    })
    const transferId = (await createRes.json()).transfer.id

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/check-approve`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/send`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/mark-arrived`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/start-verification`, { headers: { Cookie: authCookie } })

    const transferData = await (await page.request.get(`${BASE_URL}/api/transfers/${transferId}`, { headers: { Cookie: authCookie } })).json()
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/verify-item`, {
      headers: { Cookie: authCookie },
      data: { itemId: transferData.items[0].id, receivedQuantity: 4 }
    })

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/complete`, { headers: { Cookie: authCookie }, data: {} })

    // Check stock transactions
    const txRes = await page.request.get(
      `${BASE_URL}/api/stock-transactions?referenceId=${transferId}&referenceType=stock_transfer`,
      { headers: { Cookie: authCookie } }
    )

    const txData = await txRes.json()
    const transactions = txData.transactions || txData

    // Should have 2 transactions: transfer_out and transfer_in
    const outTx = transactions.find((tx: any) => tx.type === 'transfer_out')
    const inTx = transactions.find((tx: any) => tx.type === 'transfer_in')

    expect(outTx).toBeTruthy()
    expect(inTx).toBeTruthy()
    expect(parseFloat(outTx.quantity)).toBe(-4)
    expect(parseFloat(inTx.quantity)).toBe(4)

    console.log(`  ✓ Transfer OUT transaction: -4 units`)
    console.log(`  ✓ Transfer IN transaction: +4 units`)

    console.log(`  ✅ AUDIT TRAIL TEST PASSED`)
  })

  test('TEST 7: Insufficient stock validation', async ({ page }) => {
    console.log('\n🚫 TEST 7: Testing insufficient stock validation')

    // Try to create transfer with more than available
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: 999999 }]
      }
    })

    if (createRes.status() === 201) {
      // If creation allowed, try to send
      const transferId = (await createRes.json()).transfer.id
      await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })
      await page.request.post(`${BASE_URL}/api/transfers/${transferId}/check-approve`, { headers: { Cookie: authCookie }, data: {} })

      const sendRes = await page.request.post(
        `${BASE_URL}/api/transfers/${transferId}/send`,
        { headers: { Cookie: authCookie }, data: {} }
      )

      expect(sendRes.status()).toBe(500)
      const error = await sendRes.json()
      expect(error.error.toLowerCase()).toContain('insufficient' || 'stock')
      console.log(`  ✓ Send blocked: ${error.error}`)
    } else {
      expect(createRes.status()).toBe(400)
      console.log(`  ✓ Creation blocked with insufficient stock`)
    }

    console.log(`  ✅ INSUFFICIENT STOCK TEST PASSED`)
  })

  test('TEST 8: Complete audit log verification', async ({ page }) => {
    console.log('\n📝 TEST 8: Testing complete audit log')

    // Create and complete transfer
    const createRes = await page.request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: authCookie },
      data: {
        fromLocationId: originLocationId,
        toLocationId: destLocationId,
        transferDate: new Date().toISOString(),
        items: [{ productId, productVariationId: variationId, quantity: 1 }]
      }
    })
    const transferId = (await createRes.json()).transfer.id

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/submit-for-check`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/check-approve`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/send`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/mark-arrived`, { headers: { Cookie: authCookie }, data: {} })
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/start-verification`, { headers: { Cookie: authCookie } })

    const transferData = await (await page.request.get(`${BASE_URL}/api/transfers/${transferId}`, { headers: { Cookie: authCookie } })).json()
    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/verify-item`, {
      headers: { Cookie: authCookie },
      data: { itemId: transferData.items[0].id, receivedQuantity: 1 }
    })

    await page.request.post(`${BASE_URL}/api/transfers/${transferId}/complete`, { headers: { Cookie: authCookie }, data: {} })

    // Check audit logs
    const logsRes = await page.request.get(
      `${BASE_URL}/api/audit-logs?entityType=stock_transfer&entityId=${transferId}`,
      { headers: { Cookie: authCookie } }
    )

    const logs = await logsRes.json()

    // Should have at least 7 logs
    expect(logs.length).toBeGreaterThanOrEqual(7)

    const actions = logs.map((log: any) => log.action)
    expect(actions).toContain('transfer_create')
    expect(actions).toContain('transfer_submit')
    expect(actions).toContain('transfer_check_approve')
    expect(actions).toContain('transfer_send')
    expect(actions).toContain('transfer_arrived')
    expect(actions).toContain('transfer_complete')

    console.log(`  ✓ Found ${logs.length} audit log entries`)
    console.log(`  ✓ All critical actions logged`)

    console.log(`  ✅ AUDIT LOG TEST PASSED`)
  })
})
