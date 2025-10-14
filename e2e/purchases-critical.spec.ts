import { test, expect, Page, APIRequestContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * CRITICAL PURCHASES MODULE TEST
 * Focused on core PO + GRN functionality with serial numbers
 */

test.describe('Purchases Module - Critical Path Testing', () => {
  let testSupplierId: number
  let testProductId: number
  let testProductVariationId: number
  let testSerializedProductId: number
  let testSerializedVariationId: number
  let testLocationId: number
  let testBusinessId: number
  let apiContext: APIRequestContext

  test.beforeAll(async ({ browser }) => {
    // Get test data
    const superadmin = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: { business: { include: { locations: true } } }
    })

    if (!superadmin?.business) throw new Error('Superadmin not found')

    testBusinessId = superadmin.businessId!
    testLocationId = superadmin.business.locations[0]?.id

    // Create test supplier
    const supplier = await prisma.supplier.create({
      data: {
        businessId: testBusinessId,
        name: 'Test Supplier Critical',
        isActive: true,
      },
    })
    testSupplierId = supplier.id

    // Create product WITHOUT serial tracking
    const product = await prisma.product.create({
      data: {
        businessId: testBusinessId,
        name: 'Regular Product Test',
        type: 'single',
        sku: `REG-${Date.now()}`,
        enableStock: true,
        enableProductInfo: false,
        isActive: true,
      },
    })
    testProductId = product.id

    const variation = await prisma.productVariation.create({
      data: {
        productId: product.id,
        name: 'Default',
        sku: `${product.sku}-VAR`,
        purchasePrice: 100.00,
        sellingPrice: 150.00,
        isDefault: true,
      },
    })
    testProductVariationId = variation.id

    // Create product WITH serial tracking
    const serializedProduct = await prisma.product.create({
      data: {
        businessId: testBusinessId,
        name: 'Serialized Product Test',
        type: 'single',
        sku: `SERIAL-${Date.now()}`,
        enableStock: true,
        enableProductInfo: true,
        isActive: true,
      },
    })
    testSerializedProductId = serializedProduct.id

    const serializedVariation = await prisma.productVariation.create({
      data: {
        productId: serializedProduct.id,
        name: 'Default',
        sku: `${serializedProduct.sku}-VAR`,
        purchasePrice: 500.00,
        sellingPrice: 750.00,
        isDefault: true,
      },
    })
    testSerializedVariationId = serializedVariation.id

    console.log(`Test setup complete. Supplier: ${testSupplierId}, Products: ${testProductId}, ${testSerializedProductId}`)
  })

  test.afterAll(async () => {
    // Cleanup
    await prisma.purchaseReceiptItem.deleteMany({ where: { purchaseReceipt: { purchase: { supplierId: testSupplierId } } } })
    await prisma.purchaseReceipt.deleteMany({ where: { purchase: { supplierId: testSupplierId } } })
    await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: testSupplierId } } })
    await prisma.stockTransaction.deleteMany({ where: { businessId: testBusinessId, productId: { in: [testProductId, testSerializedProductId] } } })
    await prisma.productSerialNumber.deleteMany({ where: { businessId: testBusinessId, productId: { in: [testProductId, testSerializedProductId] } } })
    await prisma.purchase.deleteMany({ where: { supplierId: testSupplierId } })
    await prisma.productVariation.deleteMany({ where: { productId: { in: [testProductId, testSerializedProductId] } } })
    await prisma.variationLocationDetails.deleteMany({ where: { productId: { in: [testProductId, testSerializedProductId] } } })
    await prisma.product.deleteMany({ where: { id: { in: [testProductId, testSerializedProductId] } } })
    await prisma.supplier.delete({ where: { id: testSupplierId } })
    await prisma.$disconnect()
  })

  // No need for beforeEach login when using request fixture directly

  test('Test 1: Create Purchase Order - Happy Path', async ({ request }) => {
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      expectedDeliveryDate: '2025-01-13',
      items: [
        {
          productId: testProductId,
          productVariationId: testProductVariationId,
          quantity: 10,
          unitCost: 100.00,
          requiresSerial: false,
        },
      ],
      taxAmount: 0,
      discountAmount: 0,
      shippingCost: 0,
      notes: 'Test PO',
    }

    const response = await request.post('/api/purchases', { data: poData })
    const data = await response.json()

    console.log('PO Response:', JSON.stringify(data, null, 2))

    expect(response.status()).toBe(201)
    expect(data.purchaseOrderNumber).toMatch(/^PO-\d{6}-\d{4}$/)
    expect(data.status).toBe('pending')
    expect(parseFloat(data.subtotal)).toBe(1000.00)

    // Verify in database
    const purchase = await prisma.purchase.findUnique({
      where: { id: data.id },
      include: { items: true },
    })
    expect(purchase).toBeTruthy()
    expect(purchase!.items.length).toBe(1)

    console.log('✓ Purchase Order created successfully')
  })

  test('Test 2: Create GRN - No Serial Numbers', async ({ request }) => {
    // Create PO first
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testProductId,
          productVariationId: testProductVariationId,
          quantity: 10,
          unitCost: 100.00,
          requiresSerial: false,
        },
      ],
    }

    const poResponse = await request.post('/api/purchases', { data: poData })
    const poData2 = await poResponse.json()
    const purchaseId = poData2.id
    const purchaseItemId = poData2.items[0].id

    // Get initial stock
    const initialStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testProductVariationId,
          locationId: testLocationId,
        },
      },
    })
    const initialQty = initialStock ? parseFloat(initialStock.qtyAvailable.toString()) : 0

    // Create GRN
    const grnData = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: purchaseItemId,
          quantityReceived: 10,
        },
      ],
    }

    const grnResponse = await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData })
    const grnDataResponse = await grnResponse.json()

    console.log('GRN Response:', JSON.stringify(grnDataResponse, null, 2))

    expect(grnResponse.status()).toBe(201)
    expect(grnDataResponse.receiptNumber).toMatch(/^GRN-\d{6}-\d{4}$/)

    // Verify stock updated
    const updatedStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testProductVariationId,
          locationId: testLocationId,
        },
      },
    })
    const newQty = parseFloat(updatedStock!.qtyAvailable.toString())
    expect(newQty).toBe(initialQty + 10)

    // Verify purchase status
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
    expect(purchase!.status).toBe('received')

    console.log(`✓ GRN created successfully. Stock: ${initialQty} → ${newQty}`)
  })

  test('Test 3: Create GRN - With Serial Numbers', async ({ request }) => {
    // Create PO
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testSerializedProductId,
          productVariationId: testSerializedVariationId,
          quantity: 3,
          unitCost: 500.00,
          requiresSerial: true,
        },
      ],
    }

    const poResponse = await request.post('/api/purchases', { data: poData })
    const poDataResponse = await poResponse.json()
    const purchaseId = poDataResponse.id
    const purchaseItemId = poDataResponse.items[0].id

    // Create GRN with serial numbers
    const timestamp = Date.now()
    const grnData = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: purchaseItemId,
          quantityReceived: 3,
          serialNumbers: [
            { serialNumber: `SN${timestamp}-001`, imei: `IMEI${timestamp}001`, condition: 'new' },
            { serialNumber: `SN${timestamp}-002`, imei: `IMEI${timestamp}002`, condition: 'new' },
            { serialNumber: `SN${timestamp}-003`, imei: `IMEI${timestamp}003`, condition: 'new' },
          ],
        },
      ],
    }

    const grnResponse = await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData })
    const grnDataResponse = await grnResponse.json()

    console.log('GRN with Serials Response:', JSON.stringify(grnDataResponse, null, 2))

    expect(grnResponse.status()).toBe(201)

    // Verify serial numbers created
    const serialNumbers = await prisma.productSerialNumber.findMany({
      where: { purchaseId: purchaseId },
    })
    expect(serialNumbers.length).toBe(3)

    for (const sn of serialNumbers) {
      expect(sn.status).toBe('in_stock')
      expect(sn.condition).toBe('new')
      expect(sn.currentLocationId).toBe(testLocationId)
    }

    console.log('✓ GRN with serial numbers created successfully')
  })

  test('Test 4: Validation - Over-receiving', async ({ request }) => {
    // Create PO for 10 items
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testProductId,
          productVariationId: testProductVariationId,
          quantity: 10,
          unitCost: 100.00,
        },
      ],
    }

    const poResponse = await request.post('/api/purchases', { data: poData })
    const poDataResponse = await poResponse.json()
    const purchaseId = poDataResponse.id
    const purchaseItemId = poDataResponse.items[0].id

    // Try to receive 15 items
    const grnData = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: purchaseItemId,
          quantityReceived: 15,
        },
      ],
    }

    const grnResponse = await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData })
    const grnDataResponse = await grnResponse.json()

    expect(grnResponse.status()).toBe(400)
    expect(grnDataResponse.error).toContain('Cannot receive more than ordered quantity')

    console.log('✓ Over-receiving validation works')
  })

  test('Test 5: Validation - Serial Number Mismatch', async ({ request }) => {
    // Create PO
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testSerializedProductId,
          productVariationId: testSerializedVariationId,
          quantity: 3,
          unitCost: 500.00,
          requiresSerial: true,
        },
      ],
    }

    const poResponse = await request.post('/api/purchases', { data: poData })
    const poDataResponse = await poResponse.json()
    const purchaseId = poDataResponse.id
    const purchaseItemId = poDataResponse.items[0].id

    // Try to receive with only 2 serial numbers
    const grnData = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: purchaseItemId,
          quantityReceived: 3,
          serialNumbers: [
            { serialNumber: 'SN-001', condition: 'new' },
            { serialNumber: 'SN-002', condition: 'new' },
          ],
        },
      ],
    }

    const grnResponse = await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData })
    const grnDataResponse = await grnResponse.json()

    expect(grnResponse.status()).toBe(400)
    expect(grnDataResponse.error).toContain('Serial number count mismatch')

    console.log('✓ Serial number count validation works')
  })

  test('Test 6: Validation - Duplicate Serial Number', async ({ request }) => {
    const timestamp = Date.now()

    // First PO with serial number
    const poData1 = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testSerializedProductId,
          productVariationId: testSerializedVariationId,
          quantity: 1,
          unitCost: 500.00,
          requiresSerial: true,
        },
      ],
    }

    const poResponse1 = await request.post('/api/purchases', { data: poData1 })
    const poDataResponse1 = await poResponse1.json()

    const grnData1 = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: poDataResponse1.items[0].id,
          quantityReceived: 1,
          serialNumbers: [{ serialNumber: `SN-DUPLICATE-${timestamp}`, condition: 'new' }],
        },
      ],
    }

    await request.post(`/api/purchases/${poDataResponse1.id}/receive`, { data: grnData1 })

    // Second PO with same serial number
    const poData2 = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testSerializedProductId,
          productVariationId: testSerializedVariationId,
          quantity: 1,
          unitCost: 500.00,
          requiresSerial: true,
        },
      ],
    }

    const poResponse2 = await request.post('/api/purchases', { data: poData2 })
    const poDataResponse2 = await poResponse2.json()

    const grnData2 = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: poDataResponse2.items[0].id,
          quantityReceived: 1,
          serialNumbers: [{ serialNumber: `SN-DUPLICATE-${timestamp}`, condition: 'new' }],
        },
      ],
    }

    const grnResponse2 = await request.post(`/api/purchases/${poDataResponse2.id}/receive`, { data: grnData2 })
    const grnDataResponse2 = await grnResponse2.json()

    expect(grnResponse2.status()).toBe(400)
    expect(grnDataResponse2.error).toContain('already exists')

    console.log('✓ Duplicate serial number detection works')
  })

  test('Test 7: Partial Receiving', async ({ request }) => {
    // Create PO for 10 items
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testProductId,
          productVariationId: testProductVariationId,
          quantity: 10,
          unitCost: 100.00,
        },
      ],
    }

    const poResponse = await request.post('/api/purchases', { data: poData })
    const poDataResponse = await poResponse.json()
    const purchaseId = poDataResponse.id
    const purchaseItemId = poDataResponse.items[0].id

    // Receive 7 items
    const grnData1 = {
      receiptDate: '2025-01-06',
      items: [{ purchaseItemId: purchaseItemId, quantityReceived: 7 }],
    }

    await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData1 })

    // Check status
    let purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
    expect(purchase!.status).toBe('partially_received')
    console.log('✓ Partial receipt 1: 7/10 items - status: partially_received')

    // Receive remaining 3 items
    const grnData2 = {
      receiptDate: '2025-01-06',
      items: [{ purchaseItemId: purchaseItemId, quantityReceived: 3 }],
    }

    await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData2 })

    // Check status
    purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
    expect(purchase!.status).toBe('received')
    console.log('✓ Partial receipt 2: 10/10 items - status: received')
  })

  test('Test 8: Audit Trail Verification', async ({ request }) => {
    // Create PO
    const poData = {
      locationId: testLocationId,
      supplierId: testSupplierId,
      purchaseDate: '2025-01-06',
      items: [
        {
          productId: testProductId,
          productVariationId: testProductVariationId,
          quantity: 5,
          unitCost: 100.00,
        },
      ],
    }

    const poResponse = await request.post('/api/purchases', { data: poData })
    const poDataResponse = await poResponse.json()
    const purchaseId = poDataResponse.id

    // Create GRN
    const grnData = {
      receiptDate: '2025-01-06',
      items: [
        {
          purchaseItemId: poDataResponse.items[0].id,
          quantityReceived: 5,
        },
      ],
    }

    const grnResponse = await request.post(`/api/purchases/${purchaseId}/receive`, { data: grnData })
    const grnDataResponse = await grnResponse.json()

    // Verify PO audit log
    const poAuditLog = await prisma.auditLog.findFirst({
      where: {
        businessId: testBusinessId,
        action: 'purchase_order_create',
        entityIds: { contains: `${purchaseId}` },
      },
    })

    expect(poAuditLog).toBeTruthy()
    expect(poAuditLog!.userId).toBeTruthy()
    expect(poAuditLog!.ipAddress).toBeTruthy()
    console.log('✓ PO audit log verified')

    // Verify GRN audit log
    const grnAuditLog = await prisma.auditLog.findFirst({
      where: {
        businessId: testBusinessId,
        action: 'purchase_receipt_create',
        entityIds: { contains: `${grnDataResponse.id}` },
      },
    })

    expect(grnAuditLog).toBeTruthy()
    console.log('✓ GRN audit log verified')
  })
})
