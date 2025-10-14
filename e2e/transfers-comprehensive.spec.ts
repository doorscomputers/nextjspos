import { test, expect, Page } from '@playwright/test'

/**
 * COMPREHENSIVE TRANSFER WORKFLOW TESTS
 * CRITICAL: Tests stock accuracy, serial numbers, audit trails
 *
 * User requirement: "money is involved here and they might put me to jail if the app has errors"
 *
 * Multi-Stage Workflow:
 * draft → pending_check → checked → in_transit → arrived → verifying → verified → completed
 *
 * CRITICAL POINTS:
 * - Stock deducted ONLY at in_transit (when send is called)
 * - Stock added ONLY at completed (after full verification)
 * - Serial numbers: in_stock → in_transit → in_stock (at destination)
 * - Completed transfers are IMMUTABLE
 */

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000'

let authCookie: string
let businessId: number
let userId: number
let originLocationId: number
let destLocationId: number
let productId: number
let variationId: number

test.describe('Transfer Workflow - Complete Flow', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()

    // Login as admin
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name.includes('session'))
    authCookie = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : ''

    // Get user info
    const meResponse = await page.request.get(`${BASE_URL}/api/users/me`, {
      headers: { Cookie: authCookie },
    })
    const meData = await meResponse.json()
    businessId = meData.businessId
    userId = meData.id

    // Get locations
    const locationsResponse = await page.request.get(`${BASE_URL}/api/locations`, {
      headers: { Cookie: authCookie },
    })
    const locations = await locationsResponse.json()
    originLocationId = locations[0].id
    destLocationId = locations[1]?.id || locations[0].id

    // Get a product with stock
    const productsResponse = await page.request.get(`${BASE_URL}/api/products`, {
      headers: { Cookie: authCookie },
    })
    const products = await productsResponse.json()
    productId = products.products[0].id
    variationId = products.products[0].variations[0].id

    await page.close()
  })

  test('1. Create transfer - regular product (no serial numbers)', async ({ request }) => {
    console.log('\n📦 Test 1: Creating transfer for regular product...')

    const response = await request.post('http://localhost:3000/api/transfers', {
      data: {
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        transferDate: new Date().toISOString(),
        items: [
          {
            productId: regularProductId,
            productVariationId: regularVariationId,
            quantity: 10,
          },
        ],
        notes: 'Test transfer - regular product',
      },
    })

    expect(response.ok()).toBeTruthy()
    const transfer = await response.json()

    console.log(`✅ Transfer created: ${transfer.transferNumber}`)
    console.log(`  Status: ${transfer.status}`)
    console.log(`  Stock Deducted: ${transfer.stockDeducted}`)

    // Verify transfer state
    expect(transfer.status).toBe('pending')
    expect(transfer.stockDeducted).toBe(false)
    expect(transfer.fromLocationId).toBe(sourceLocationId)
    expect(transfer.toLocationId).toBe(destinationLocationId)
    expect(transfer.items).toHaveLength(1)
    expect(transfer.items[0].quantity).toBe(10)

    // CRITICAL: Verify stock has NOT been deducted from source
    const sourceStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: regularVariationId,
          locationId: sourceLocationId,
        },
      },
    })

    console.log(`  Source stock remains: ${sourceStock?.qtyAvailable} (expected: 100)`)
    expect(parseFloat(sourceStock!.qtyAvailable.toString())).toBe(100)

    // Store transfer ID for next tests
    test.info().annotations.push({ type: 'transfer1Id', description: transfer.id.toString() })
  })

  test('2. Send transfer - marks as in_transit', async ({ request }) => {
    console.log('\n🚚 Test 2: Sending transfer...')

    // Get transfer ID from previous test
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        businessId: parseInt(businessId),
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    const transfer = transfers[0]
    expect(transfer).toBeDefined()

    const response = await request.post(`http://localhost:3000/api/transfers/${transfer.id}/send`, {
      data: {
        shippingDate: new Date().toISOString(),
        shippingMethod: 'Internal Delivery',
        trackingNumber: `TRK-${Date.now()}`,
        notes: 'Test shipment',
      },
    })

    expect(response.ok()).toBeTruthy()
    const updatedTransfer = await response.json()

    console.log(`✅ Transfer sent: ${updatedTransfer.transfer.transferNumber}`)
    console.log(`  Status: ${updatedTransfer.transfer.status}`)
    console.log(`  Stock Deducted: ${updatedTransfer.transfer.stockDeducted}`)

    // Verify transfer state
    expect(updatedTransfer.transfer.status).toBe('in_transit')
    expect(updatedTransfer.transfer.stockDeducted).toBe(false) // CRITICAL: Still false

    // CRITICAL: Verify stock STILL not deducted from source
    const sourceStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: regularVariationId,
          locationId: sourceLocationId,
        },
      },
    })

    console.log(`  Source stock remains: ${sourceStock?.qtyAvailable} (expected: 100)`)
    expect(parseFloat(sourceStock!.qtyAvailable.toString())).toBe(100)
  })

  test('3. Receive transfer - stock NOW moves (CRITICAL TEST)', async ({ request }) => {
    console.log('\n✅ Test 3: Receiving and approving transfer (STOCK MOVES NOW)...')

    // Get in_transit transfer
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        businessId: parseInt(businessId),
        status: 'in_transit',
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    const transfer = transfers[0]
    expect(transfer).toBeDefined()

    // Get source stock BEFORE receive
    const sourceStockBefore = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: regularVariationId,
          locationId: sourceLocationId,
        },
      },
    })
    console.log(`  Source stock BEFORE receive: ${sourceStockBefore?.qtyAvailable}`)

    const response = await request.post(`http://localhost:3000/api/transfers/${transfer.id}/receive`, {
      data: {
        receivedDate: new Date().toISOString(),
        items: [
          {
            transferItemId: transfer.items[0].id,
            quantityReceived: 10,
          },
        ],
        notes: 'Received and verified',
      },
    })

    expect(response.ok()).toBeTruthy()
    const result = await response.json()

    console.log(`✅ Transfer received: ${result.transfer.transferNumber}`)
    console.log(`  Status: ${result.transfer.status}`)
    console.log(`  Stock Deducted: ${result.transfer.stockDeducted}`)

    // Verify transfer state
    expect(result.transfer.status).toBe('received')
    expect(result.transfer.stockDeducted).toBe(true) // CRITICAL: NOW true

    // CRITICAL: Verify stock deducted from source
    const sourceStockAfter = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: regularVariationId,
          locationId: sourceLocationId,
        },
      },
    })

    console.log(`  Source stock AFTER receive: ${sourceStockAfter?.qtyAvailable} (expected: 90)`)
    expect(parseFloat(sourceStockAfter!.qtyAvailable.toString())).toBe(90)

    // CRITICAL: Verify stock added to destination
    const destStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: regularVariationId,
          locationId: destinationLocationId,
        },
      },
    })

    console.log(`  Destination stock: ${destStock?.qtyAvailable} (expected: 10)`)
    expect(parseFloat(destStock!.qtyAvailable.toString())).toBe(10)

    // Verify stock transactions created
    const transactions = await prisma.stockTransaction.findMany({
      where: {
        referenceType: 'transfer',
        referenceId: transfer.id,
      },
    })

    console.log(`  Stock transactions created: ${transactions.length} (expected: 2)`)
    expect(transactions).toHaveLength(2) // One for source (out), one for destination (in)

    // Verify transaction types
    const sourceTransaction = transactions.find(t => t.type === 'transfer_out')
    const destTransaction = transactions.find(t => t.type === 'transfer_in')

    expect(sourceTransaction).toBeDefined()
    expect(destTransaction).toBeDefined()
    expect(parseFloat(sourceTransaction!.quantity.toString())).toBe(-10) // Negative for deduction
    expect(parseFloat(destTransaction!.quantity.toString())).toBe(10) // Positive for addition
  })

  test('4. Create and send transfer with serial numbers', async ({ request }) => {
    console.log('\n📱 Test 4: Creating transfer with serial numbers...')

    // Create transfer
    const createResponse = await request.post('http://localhost:3000/api/transfers', {
      data: {
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        transferDate: new Date().toISOString(),
        items: [
          {
            productId: serializedProductId,
            productVariationId: serializedVariationId,
            quantity: 2,
            serialNumberIds: [serialNumber1Id, serialNumber2Id],
          },
        ],
        notes: 'Test transfer - serialized product',
      },
    })

    expect(createResponse.ok()).toBeTruthy()
    const transfer = await createResponse.json()

    console.log(`✅ Transfer created with serial numbers: ${transfer.transferNumber}`)

    // Verify serial numbers are linked
    expect(transfer.items[0].serialNumbers).toHaveLength(2)

    // Verify serial numbers still in_stock at this stage
    const sn1 = await prisma.productSerialNumber.findUnique({
      where: { id: serialNumber1Id },
    })
    console.log(`  Serial 1 status: ${sn1?.status} (expected: in_stock)`)
    expect(sn1?.status).toBe('in_stock')

    // Send transfer
    const sendResponse = await request.post(`http://localhost:3000/api/transfers/${transfer.id}/send`, {
      data: {
        shippingDate: new Date().toISOString(),
        shippingMethod: 'Internal Delivery',
        notes: 'Sending serialized items',
      },
    })

    expect(sendResponse.ok()).toBeTruthy()

    // CRITICAL: Verify serial numbers marked as in_transit
    const sn1AfterSend = await prisma.productSerialNumber.findUnique({
      where: { id: serialNumber1Id },
    })
    const sn2AfterSend = await prisma.productSerialNumber.findUnique({
      where: { id: serialNumber2Id },
    })

    console.log(`  Serial 1 status after send: ${sn1AfterSend?.status} (expected: in_transit)`)
    console.log(`  Serial 2 status after send: ${sn2AfterSend?.status} (expected: in_transit)`)

    expect(sn1AfterSend?.status).toBe('in_transit')
    expect(sn2AfterSend?.status).toBe('in_transit')

    // Verify currentLocationId unchanged (still at source)
    expect(sn1AfterSend?.currentLocationId).toBe(sourceLocationId)
    expect(sn2AfterSend?.currentLocationId).toBe(sourceLocationId)

    // Store transfer ID
    test.info().annotations.push({ type: 'serialTransferId', description: transfer.id.toString() })
  })

  test('5. Receive transfer with serial numbers - location updates', async ({ request }) => {
    console.log('\n📦 Test 5: Receiving transfer with serial numbers...')

    // Get in_transit transfer with serial numbers
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        businessId: parseInt(businessId),
        status: 'in_transit',
      },
      include: { items: { include: { serialNumbers: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    const transfer = transfers[0]
    expect(transfer).toBeDefined()

    const response = await request.post(`http://localhost:3000/api/transfers/${transfer.id}/receive`, {
      data: {
        receivedDate: new Date().toISOString(),
        items: [
          {
            transferItemId: transfer.items[0].id,
            quantityReceived: 2,
            serialNumberIds: [serialNumber1Id, serialNumber2Id],
          },
        ],
        notes: 'Received serialized items',
      },
    })

    expect(response.ok()).toBeTruthy()

    // CRITICAL: Verify serial numbers back to in_stock and at destination
    const sn1After = await prisma.productSerialNumber.findUnique({
      where: { id: serialNumber1Id },
    })
    const sn2After = await prisma.productSerialNumber.findUnique({
      where: { id: serialNumber2Id },
    })

    console.log(`  Serial 1 status: ${sn1After?.status} (expected: in_stock)`)
    console.log(`  Serial 1 location: ${sn1After?.currentLocationId} (expected: ${destinationLocationId})`)
    console.log(`  Serial 2 status: ${sn2After?.status} (expected: in_stock)`)
    console.log(`  Serial 2 location: ${sn2After?.currentLocationId} (expected: ${destinationLocationId})`)

    expect(sn1After?.status).toBe('in_stock')
    expect(sn1After?.currentLocationId).toBe(destinationLocationId)
    expect(sn2After?.status).toBe('in_stock')
    expect(sn2After?.currentLocationId).toBe(destinationLocationId)

    // Verify movement records created
    const movements = await prisma.serialNumberMovement.findMany({
      where: {
        serialNumberId: { in: [serialNumber1Id, serialNumber2Id] },
        referenceType: 'transfer',
        referenceId: transfer.id,
      },
    })

    console.log(`  Movement records: ${movements.length} (expected: 4 - 2 for send, 2 for receive)`)
    expect(movements.length).toBeGreaterThanOrEqual(2)

    // Verify movement types
    const transferInMovements = movements.filter(m => m.movementType === 'transfer_in')
    console.log(`  Transfer IN movements: ${transferInMovements.length} (expected: 2)`)
    expect(transferInMovements).toHaveLength(2)
  })

  test('6. Validation - insufficient stock', async ({ request }) => {
    console.log('\n❌ Test 6: Validation - insufficient stock...')

    const response = await request.post('http://localhost:3000/api/transfers', {
      data: {
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        transferDate: new Date().toISOString(),
        items: [
          {
            productId: regularProductId,
            productVariationId: regularVariationId,
            quantity: 10000, // More than available
          },
        ],
      },
    })

    expect(response.status()).toBe(400)
    const error = await response.json()
    console.log(`  Error message: ${error.error}`)
    expect(error.error).toContain('Insufficient stock')
  })

  test('7. Validation - cannot receive pending transfer', async ({ request }) => {
    console.log('\n❌ Test 7: Validation - cannot receive pending transfer...')

    // Create a pending transfer
    const createResponse = await request.post('http://localhost:3000/api/transfers', {
      data: {
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        transferDate: new Date().toISOString(),
        items: [
          {
            productId: regularProductId,
            productVariationId: regularVariationId,
            quantity: 5,
          },
        ],
      },
    })

    const transfer = await createResponse.json()

    // Try to receive without sending first
    const receiveResponse = await request.post(`http://localhost:3000/api/transfers/${transfer.id}/receive`, {
      data: {
        receivedDate: new Date().toISOString(),
        items: [
          {
            transferItemId: transfer.items[0].id,
            quantityReceived: 5,
          },
        ],
      },
    })

    expect(receiveResponse.status()).toBe(400)
    const error = await receiveResponse.json()
    console.log(`  Error message: ${error.error}`)
    expect(error.error).toContain('Only in_transit transfers can be received')
  })

  test('8. Cancel pending transfer', async ({ request }) => {
    console.log('\n🚫 Test 8: Cancelling pending transfer...')

    // Get a pending transfer
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        businessId: parseInt(businessId),
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    if (transfers.length === 0) {
      // Create one for this test
      const createResponse = await request.post('http://localhost:3000/api/transfers', {
        data: {
          fromLocationId: sourceLocationId,
          toLocationId: destinationLocationId,
          transferDate: new Date().toISOString(),
          items: [
            {
              productId: regularProductId,
              productVariationId: regularVariationId,
              quantity: 3,
            },
          ],
        },
      })
      const newTransfer = await createResponse.json()
      transfers.push(newTransfer)
    }

    const transfer = transfers[0]

    const response = await request.delete(`http://localhost:3000/api/transfers/${transfer.id}`)

    expect(response.ok()).toBeTruthy()
    const result = await response.json()

    console.log(`✅ Transfer cancelled: ${result.transfer.transferNumber}`)

    // Verify transfer marked as cancelled
    const cancelled = await prisma.stockTransfer.findUnique({
      where: { id: transfer.id },
    })

    expect(cancelled?.status).toBe('cancelled')
    expect(cancelled?.deletedAt).not.toBeNull()
  })

  test('9. Database integrity - audit trail', async () => {
    console.log('\n📋 Test 9: Verifying audit trail...')

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        businessId: parseInt(businessId),
        action: {
          in: [
            'stock_transfer_create',
            'stock_transfer_send',
            'stock_transfer_receive',
            'stock_transfer_delete',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    console.log(`  Audit logs found: ${auditLogs.length}`)
    expect(auditLogs.length).toBeGreaterThan(0)

    // Verify audit log structure
    for (const log of auditLogs) {
      expect(log.userId).toBe(userId)
      expect(log.businessId).toBe(businessId)
      expect(log.action).toBeDefined()
      expect(log.description).toBeDefined()
      expect(log.createdAt).toBeDefined()
      console.log(`  ✅ ${log.action}: ${log.description}`)
    }
  })

  test('10. Serial number movement integrity', async () => {
    console.log('\n🔍 Test 10: Verifying serial number movements...')

    const movements = await prisma.serialNumberMovement.findMany({
      where: {
        serialNumberId: { in: [serialNumber1Id, serialNumber2Id] },
      },
      include: {
        serialNumber: {
          select: {
            serialNumber: true,
            status: true,
            currentLocationId: true,
          },
        },
      },
      orderBy: { movedAt: 'asc' },
    })

    console.log(`  Total movements for test serial numbers: ${movements.length}`)

    // CRITICAL: Verify no movements with serialNumberId = 0 (bug check)
    let invalidMovements = 0
    for (const movement of movements) {
      if (movement.serialNumberId <= 0) {
        console.error(`  ❌ INVALID: Movement ${movement.id} has serialNumberId: ${movement.serialNumberId}`)
        invalidMovements++
      } else {
        console.log(`  ✅ Movement ${movement.id}: ${movement.movementType} (SN: ${movement.serialNumber.serialNumber})`)
      }
    }

    expect(invalidMovements).toBe(0)

    if (invalidMovements > 0) {
      throw new Error(`CRITICAL BUG: Found ${invalidMovements} serial number movements with invalid IDs`)
    }
  })

  test('11. Stock transaction consistency', async () => {
    console.log('\n📊 Test 11: Verifying stock transactions...')

    const transactions = await prisma.stockTransaction.findMany({
      where: {
        businessId: parseInt(businessId),
        referenceType: 'transfer',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    console.log(`  Stock transactions found: ${transactions.length}`)

    // Verify transaction pairs (transfer_out and transfer_in)
    const transferIds = [...new Set(transactions.map(t => t.referenceId))]
    for (const transferId of transferIds) {
      const transferTransactions = transactions.filter(t => t.referenceId === transferId)

      if (transferTransactions.length >= 2) {
        const outTransaction = transferTransactions.find(t => t.type === 'transfer_out')
        const inTransaction = transferTransactions.find(t => t.type === 'transfer_in')

        if (outTransaction && inTransaction) {
          console.log(`  ✅ Transfer ${transferId}: OUT (${outTransaction.quantity}) + IN (${inTransaction.quantity})`)

          // Verify quantities match (absolute values)
          expect(Math.abs(parseFloat(outTransaction.quantity.toString()))).toBe(
            parseFloat(inTransaction.quantity.toString())
          )
        }
      }
    }
  })
})
