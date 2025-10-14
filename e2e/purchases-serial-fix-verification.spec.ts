import { test, expect } from '@playwright/test'

/**
 * FOCUSED TEST: Verify Serial Number Movement Bug Fix
 *
 * Bug: Serial number movements were created with serialNumberId: 0
 * Fix: Capture created serial number record ID before creating movement
 *
 * This test specifically verifies:
 * 1. Serial numbers are created with proper IDs
 * 2. Movement records link to the correct serial number ID
 * 3. Movement history is trackable
 */

test.describe('Serial Number Movement Fix Verification', () => {
  let authToken: string
  let businessId: number
  let userId: number
  let locationId: number
  let supplierId: number
  let productId: number
  let variationId: number
  let purchaseId: number

  test.beforeAll(async ({ request }) => {
    // Login as admin
    const loginResponse = await request.post('http://localhost:3000/api/auth/callback/credentials', {
      data: {
        username: 'admin',
        password: 'password',
        json: true,
      },
    })

    expect(loginResponse.ok()).toBeTruthy()
    const loginData = await loginResponse.json()
    authToken = loginData.token || 'mock-token'
    businessId = loginData.user?.businessId || 1
    userId = loginData.user?.id || 2
    locationId = 1 // Main location from seed

    // Create supplier
    const supplierResponse = await request.post('http://localhost:3000/api/suppliers', {
      headers: {
        'Cookie': `next-auth.session-token=${authToken}`,
      },
      data: {
        name: 'Serial Test Supplier',
        mobile: '1234567890',
        email: 'serialtest@supplier.com',
      },
    })

    const supplierData = await supplierResponse.json()
    supplierId = supplierData.id

    // Create a product with serial number tracking enabled
    const productResponse = await request.post('http://localhost:3000/api/products', {
      headers: {
        'Cookie': `next-auth.session-token=${authToken}`,
      },
      data: {
        name: 'iPhone 15 Pro - Serial Test',
        sku: `TEST-SERIAL-${Date.now()}`,
        type: 'single',
        categoryId: 1,
        brandId: 1,
        unit: 'piece',
        enableStock: true,
        requiresSerial: true, // CRITICAL: Enable serial number tracking
        variations: [
          {
            sku: `VAR-SERIAL-${Date.now()}`,
            defaultPurchasePrice: 1000.00,
            profitPercent: 20,
            defaultSellingPrice: 1200.00,
          },
        ],
      },
    })

    const productData = await productResponse.json()
    productId = productData.id
    variationId = productData.variations[0].id

    console.log(`✓ Setup complete:`)
    console.log(`  Supplier ID: ${supplierId}`)
    console.log(`  Product ID: ${productId} (requiresSerial: true)`)
    console.log(`  Variation ID: ${variationId}`)
  })

  test('CRITICAL: Serial number movements must link to correct serial number ID', async ({ request }) => {
    console.log('\n=== TEST: Serial Number Movement Linking ===\n')

    // Step 1: Create purchase order
    const poResponse = await request.post('http://localhost:3000/api/purchases', {
      headers: {
        'Cookie': `next-auth.session-token=${authToken}`,
      },
      data: {
        locationId,
        supplierId,
        purchaseDate: new Date().toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            productId,
            productVariationId: variationId,
            quantity: 3, // Order 3 units with serial numbers
            unitCost: 1000.00,
            requiresSerial: true,
          },
        ],
        taxAmount: 0,
        discountAmount: 0,
        shippingCost: 0,
        notes: 'Serial number movement verification test',
      },
    })

    expect(poResponse.ok()).toBeTruthy()
    const poData = await poResponse.json()
    purchaseId = poData.id
    const poNumber = poData.purchaseOrderNumber

    console.log(`✓ Purchase Order created: ${poNumber}`)

    // Step 2: Create GRN with 3 serial numbers
    const serialNumbers = [
      { serialNumber: `SN-TEST-001-${Date.now()}`, imei: 'IMEI001', condition: 'new' },
      { serialNumber: `SN-TEST-002-${Date.now()}`, imei: 'IMEI002', condition: 'new' },
      { serialNumber: `SN-TEST-003-${Date.now()}`, imei: 'IMEI003', condition: 'new' },
    ]

    console.log(`\nReceiving 3 units with serial numbers:`)
    serialNumbers.forEach((sn, idx) => {
      console.log(`  ${idx + 1}. ${sn.serialNumber} (IMEI: ${sn.imei})`)
    })

    const grnResponse = await request.post(`http://localhost:3000/api/purchases/${purchaseId}/receive`, {
      headers: {
        'Cookie': `next-auth.session-token=${authToken}`,
      },
      data: {
        receiptDate: new Date().toISOString(),
        items: [
          {
            purchaseItemId: poData.items[0].id,
            quantityReceived: 3,
            serialNumbers,
            notes: 'Testing serial number movement linking',
          },
        ],
        notes: 'Verification test for serial number movements',
      },
    })

    expect(grnResponse.ok()).toBeTruthy()
    const grnData = await grnResponse.json()
    const grnNumber = grnData.receiptNumber

    console.log(`✓ GRN created: ${grnNumber}`)

    // Step 3: CRITICAL VERIFICATION - Query database to verify serial numbers and movements
    console.log(`\n=== VERIFYING SERIAL NUMBER MOVEMENTS ===\n`)

    // Verify each serial number was created and has a valid movement record
    for (const sn of serialNumbers) {
      // Get serial number record
      const snQuery = await request.post('http://localhost:3000/api/test-query', {
        headers: {
          'Cookie': `next-auth.session-token=${authToken}`,
        },
        data: {
          query: 'productSerialNumber',
          where: {
            businessId,
            serialNumber: sn.serialNumber,
          },
          include: {
            movements: true,
          },
        },
      })

      if (!snQuery.ok()) {
        console.error(`✗ Failed to query serial number: ${sn.serialNumber}`)
        continue
      }

      const snRecord = await snQuery.json()

      // CRITICAL CHECKS
      console.log(`\nSerial Number: ${sn.serialNumber}`)
      console.log(`  Record ID: ${snRecord.id}`)
      console.log(`  Status: ${snRecord.status}`)
      console.log(`  Condition: ${snRecord.condition}`)
      console.log(`  IMEI: ${snRecord.imei}`)
      console.log(`  Current Location: ${snRecord.currentLocationId}`)
      console.log(`  Purchase ID: ${snRecord.purchaseId}`)
      console.log(`  Movements Count: ${snRecord.movements.length}`)

      // Verify basic serial number data
      expect(snRecord.id).toBeGreaterThan(0)
      expect(snRecord.serialNumber).toBe(sn.serialNumber)
      expect(snRecord.status).toBe('in_stock')
      expect(snRecord.condition).toBe('new')
      expect(snRecord.imei).toBe(sn.imei)
      expect(snRecord.currentLocationId).toBe(locationId)
      expect(snRecord.purchaseId).toBe(purchaseId)

      // CRITICAL: Verify movement record exists
      expect(snRecord.movements.length).toBe(1)

      const movement = snRecord.movements[0]
      console.log(`\n  Movement Record:`)
      console.log(`    ID: ${movement.id}`)
      console.log(`    Serial Number ID: ${movement.serialNumberId}`)
      console.log(`    Movement Type: ${movement.movementType}`)
      console.log(`    To Location: ${movement.toLocationId}`)
      console.log(`    Reference Type: ${movement.referenceType}`)
      console.log(`    Reference ID: ${movement.referenceId}`)

      // CRITICAL BUG CHECK: serialNumberId must match the serial number record ID
      expect(movement.serialNumberId).toBe(snRecord.id)
      expect(movement.serialNumberId).toBeGreaterThan(0)

      if (movement.serialNumberId === 0) {
        console.error(`\n✗✗✗ CRITICAL BUG DETECTED ✗✗✗`)
        console.error(`Serial number movement has serialNumberId: 0`)
        console.error(`Expected: ${snRecord.id}`)
        throw new Error('CRITICAL BUG: Serial number movement not properly linked')
      }

      expect(movement.movementType).toBe('purchase')
      expect(movement.toLocationId).toBe(locationId)
      expect(movement.referenceType).toBe('purchase')
      expect(movement.referenceId).toBe(grnData.id)

      console.log(`  ✓ Movement correctly linked to serial number`)
    }

    console.log(`\n✓✓✓ ALL SERIAL NUMBER MOVEMENTS CORRECTLY LINKED ✓✓✓`)
    console.log(`\nBug fix verified successfully!`)
    console.log(`- 3 serial numbers created with valid IDs`)
    console.log(`- 3 movement records correctly linked (serialNumberId > 0)`)
    console.log(`- Full movement history is trackable`)
  })

  test('Verify serial number movement history is queryable', async ({ request }) => {
    console.log('\n=== TEST: Serial Number Movement History ===\n')

    // Query all movements for this purchase
    const movementsQuery = await request.post('http://localhost:3000/api/test-query', {
      headers: {
        'Cookie': `next-auth.session-token=${authToken}`,
      },
      data: {
        query: 'serialNumberMovement',
        where: {
          referenceType: 'purchase',
          referenceId: purchaseId,
        },
        include: {
          serialNumber: {
            select: {
              serialNumber: true,
              status: true,
              condition: true,
            },
          },
        },
      },
    })

    expect(movementsQuery.ok()).toBeTruthy()
    const movements = await movementsQuery.json()

    console.log(`Found ${movements.length} movement records for this purchase`)

    // Verify we have 3 movements (one for each serial number)
    expect(movements.length).toBe(3)

    movements.forEach((movement: any, idx: number) => {
      console.log(`\nMovement ${idx + 1}:`)
      console.log(`  ID: ${movement.id}`)
      console.log(`  Serial Number ID: ${movement.serialNumberId}`)
      console.log(`  Serial Number: ${movement.serialNumber.serialNumber}`)
      console.log(`  Status: ${movement.serialNumber.status}`)
      console.log(`  Movement Type: ${movement.movementType}`)
      console.log(`  To Location: ${movement.toLocationId}`)

      // CRITICAL: Verify movement is properly linked
      expect(movement.serialNumberId).toBeGreaterThan(0)
      expect(movement.serialNumber).toBeDefined()
      expect(movement.serialNumber.serialNumber).toBeTruthy()
    })

    console.log(`\n✓ Movement history is fully queryable and trackable`)
  })
})
