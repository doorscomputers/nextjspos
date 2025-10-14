/**
 * DIRECT API TESTING - PURCHASES MODULE
 * Financial system - Zero tolerance for errors
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Test configuration
const BASE_URL = 'http://localhost:3008'
const USERNAME = 'superadmin'
const PASSWORD = 'password'

let authCookies = ''
let testData = {}
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
}

// Helper to make authenticated requests
async function makeRequest(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (authCookies) {
    headers['Cookie'] = authCookies
  }

  const options = {
    method,
    headers,
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${path}`, options)

  // Capture cookies from response
  const setCookie = response.headers.get('set-cookie')
  if (setCookie && !authCookies) {
    authCookies = setCookie.split(';')[0]
  }

  let data
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  return {
    status: response.status,
    data,
    ok: response.ok
  }
}

// Test assertion helper
function assert(condition, testName, message) {
  if (condition) {
    console.log(`✓ ${testName}: ${message}`)
    testResults.passed++
    testResults.tests.push({ name: testName, status: 'PASSED', message })
    return true
  } else {
    console.error(`✗ ${testName}: ${message}`)
    testResults.failed++
    testResults.tests.push({ name: testName, status: 'FAILED', message })
    return false
  }
}

// Setup test data
async function setupTestData() {
  console.log('\n=== SETTING UP TEST DATA ===')

  const superadmin = await prisma.user.findFirst({
    where: { username: 'superadmin' },
    include: { business: { include: { locations: true } } }
  })

  testData.businessId = superadmin.businessId
  testData.locationId = superadmin.business.locations[0].id
  testData.userId = superadmin.id

  // Create supplier
  const supplier = await prisma.supplier.create({
    data: {
      businessId: testData.businessId,
      name: 'Direct Test Supplier',
      isActive: true,
    }
  })
  testData.supplierId = supplier.id

  // Create regular product
  const product = await prisma.product.create({
    data: {
      businessId: testData.businessId,
      name: 'Direct Test Product',
      type: 'single',
      sku: `DIRECT-${Date.now()}`,
      enableStock: true,
      enableProductInfo: false,
      isActive: true,
    }
  })
  testData.productId = product.id

  const variation = await prisma.productVariation.create({
    data: {
      productId: product.id,
      name: 'Default',
      sku: `${product.sku}-VAR`,
      purchasePrice: 100.00,
      sellingPrice: 150.00,
      isDefault: true,
    }
  })
  testData.variationId = variation.id

  // Create serialized product
  const serialProduct = await prisma.product.create({
    data: {
      businessId: testData.businessId,
      name: 'Direct Test Serial Product',
      type: 'single',
      sku: `SERIAL-DIRECT-${Date.now()}`,
      enableStock: true,
      enableProductInfo: true,
      isActive: true,
    }
  })
  testData.serialProductId = serialProduct.id

  const serialVariation = await prisma.productVariation.create({
    data: {
      productId: serialProduct.id,
      name: 'Default',
      sku: `${serialProduct.sku}-VAR`,
      purchasePrice: 500.00,
      sellingPrice: 750.00,
      isDefault: true,
    }
  })
  testData.serialVariationId = serialVariation.id

  console.log(`✓ Test data created: Supplier ${testData.supplierId}, Products ${testData.productId}, ${testData.serialProductId}`)
}

// Cleanup
async function cleanup() {
  console.log('\n=== CLEANING UP TEST DATA ===')

  await prisma.purchaseReceiptItem.deleteMany({ where: { purchaseReceipt: { purchase: { supplierId: testData.supplierId } } } })
  await prisma.purchaseReceipt.deleteMany({ where: { purchase: { supplierId: testData.supplierId } } })
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: testData.supplierId } } })
  await prisma.stockTransaction.deleteMany({ where: { businessId: testData.businessId, productId: { in: [testData.productId, testData.serialProductId] } } })
  await prisma.productSerialNumber.deleteMany({ where: { businessId: testData.businessId, productId: { in: [testData.productId, testData.serialProductId] } } })
  await prisma.purchase.deleteMany({ where: { supplierId: testData.supplierId } })
  await prisma.productVariation.deleteMany({ where: { productId: { in: [testData.productId, testData.serialProductId] } } })
  await prisma.variationLocationDetails.deleteMany({ where: { productId: { in: [testData.productId, testData.serialProductId] } } })
  await prisma.product.deleteMany({ where: { id: { in: [testData.productId, testData.serialProductId] } } })
  await prisma.supplier.delete({ where: { id: testData.supplierId } })

  await prisma.$disconnect()
  console.log('✓ Cleanup complete')
}

// Test 1: Login
async function testLogin() {
  console.log('\n=== TEST 1: LOGIN ===')
  const response = await makeRequest('POST', '/api/auth/callback/credentials', {
    username: USERNAME,
    password: PASSWORD,
  })

  assert(response.ok, 'Login', 'Authentication successful')
}

// Test 2: Create Purchase Order
async function testCreatePO() {
  console.log('\n=== TEST 2: CREATE PURCHASE ORDER ===')

  const poData = {
    locationId: testData.locationId,
    supplierId: testData.supplierId,
    purchaseDate: '2025-01-06',
    expectedDeliveryDate: '2025-01-13',
    items: [
      {
        productId: testData.productId,
        productVariationId: testData.variationId,
        quantity: 10,
        unitCost: 100.00,
        requiresSerial: false,
      }
    ],
    taxAmount: 0,
    discountAmount: 0,
    shippingCost: 0,
    notes: 'Test PO',
  }

  const response = await makeRequest('POST', '/api/purchases', poData)

  console.log('PO Response Status:', response.status)
  console.log('PO Response Data:', JSON.stringify(response.data, null, 2))

  assert(response.status === 201, 'Create PO', `Status is 201 (got ${response.status})`)

  if (response.data.id) {
    testData.purchaseId = response.data.id
    testData.purchaseItemId = response.data.items?.[0]?.id
    testData.poNumber = response.data.purchaseOrderNumber

    assert(testData.poNumber && testData.poNumber.startsWith('PO-'), 'Create PO', `PO number generated: ${testData.poNumber}`)
    assert(response.data.status === 'pending', 'Create PO', `Status is pending`)
    assert(parseFloat(response.data.subtotal) === 1000.00, 'Create PO', `Subtotal is correct (1000.00)`)

    // Verify in database
    const purchase = await prisma.purchase.findUnique({ where: { id: testData.purchaseId }, include: { items: true } })
    assert(purchase !== null, 'Create PO', 'Purchase record exists in database')
    assert(purchase?.items.length === 1, 'Create PO', 'Purchase has 1 item')
  } else {
    assert(false, 'Create PO', 'Failed - no purchase ID returned')
  }
}

// Test 3: Create GRN (No Serial Numbers)
async function testCreateGRN() {
  console.log('\n=== TEST 3: CREATE GRN (NO SERIAL NUMBERS) ===')

  if (!testData.purchaseId || !testData.purchaseItemId) {
    console.log('Skipping - no purchase data available')
    return
  }

  // Get initial stock
  const initialStock = await prisma.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId: testData.variationId,
        locationId: testData.locationId,
      }
    }
  })
  const initialQty = initialStock ? parseFloat(initialStock.qtyAvailable.toString()) : 0
  console.log(`Initial stock: ${initialQty}`)

  const grnData = {
    receiptDate: '2025-01-06',
    items: [
      {
        purchaseItemId: testData.purchaseItemId,
        quantityReceived: 10,
      }
    ],
  }

  const response = await makeRequest('POST', `/api/purchases/${testData.purchaseId}/receive`, grnData)

  console.log('GRN Response Status:', response.status)
  console.log('GRN Response Data:', JSON.stringify(response.data, null, 2))

  assert(response.status === 201, 'Create GRN', `Status is 201 (got ${response.status})`)

  if (response.data.id) {
    testData.grnId = response.data.id
    testData.grnNumber = response.data.receiptNumber

    assert(testData.grnNumber && testData.grnNumber.startsWith('GRN-'), 'Create GRN', `GRN number generated: ${testData.grnNumber}`)

    // Verify stock updated
    const updatedStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testData.variationId,
          locationId: testData.locationId,
        }
      }
    })
    const newQty = updatedStock ? parseFloat(updatedStock.qtyAvailable.toString()) : 0

    assert(newQty === initialQty + 10, 'Create GRN', `Stock updated correctly: ${initialQty} → ${newQty}`)

    // Verify purchase status
    const purchase = await prisma.purchase.findUnique({ where: { id: testData.purchaseId } })
    assert(purchase?.status === 'received', 'Create GRN', 'Purchase status updated to "received"')

    // Verify stock transaction
    const stockTxn = await prisma.stockTransaction.findFirst({
      where: {
        productVariationId: testData.variationId,
        locationId: testData.locationId,
        referenceType: 'purchase',
        referenceId: testData.grnId,
      }
    })
    assert(stockTxn !== null, 'Create GRN', 'Stock transaction created')
    assert(parseFloat(stockTxn?.quantity.toString() || '0') === 10, 'Create GRN', 'Stock transaction quantity is 10')

    // Verify audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        businessId: testData.businessId,
        action: 'purchase_receipt_create',
        entityIds: { contains: `${testData.grnId}` },
      }
    })
    assert(auditLog !== null, 'Create GRN', 'Audit log created')
  } else {
    assert(false, 'Create GRN', 'Failed - no GRN ID returned')
  }
}

// Test 4: Create GRN with Serial Numbers
async function testCreateGRNWithSerials() {
  console.log('\n=== TEST 4: CREATE GRN WITH SERIAL NUMBERS ===')

  // Create new PO for serialized product
  const poData = {
    locationId: testData.locationId,
    supplierId: testData.supplierId,
    purchaseDate: '2025-01-06',
    items: [
      {
        productId: testData.serialProductId,
        productVariationId: testData.serialVariationId,
        quantity: 3,
        unitCost: 500.00,
        requiresSerial: true,
      }
    ],
  }

  const poResponse = await makeRequest('POST', '/api/purchases', poData)
  if (poResponse.status !== 201) {
    assert(false, 'Create GRN with Serials', `Failed to create PO (status ${poResponse.status})`)
    return
  }

  const serialPurchaseId = poResponse.data.id
  const serialPurchaseItemId = poResponse.data.items[0].id

  // Create GRN with serial numbers
  const timestamp = Date.now()
  const grnData = {
    receiptDate: '2025-01-06',
    items: [
      {
        purchaseItemId: serialPurchaseItemId,
        quantityReceived: 3,
        serialNumbers: [
          { serialNumber: `SN${timestamp}-001`, imei: `IMEI${timestamp}001`, condition: 'new' },
          { serialNumber: `SN${timestamp}-002`, imei: `IMEI${timestamp}002`, condition: 'new' },
          { serialNumber: `SN${timestamp}-003`, imei: `IMEI${timestamp}003`, condition: 'new' },
        ]
      }
    ],
  }

  const response = await makeRequest('POST', `/api/purchases/${serialPurchaseId}/receive`, grnData)

  console.log('GRN with Serials Response Status:', response.status)
  console.log('GRN with Serials Response Data:', JSON.stringify(response.data, null, 2))

  assert(response.status === 201, 'Create GRN with Serials', `Status is 201 (got ${response.status})`)

  if (response.data.id) {
    // Verify serial numbers created
    const serialNumbers = await prisma.productSerialNumber.findMany({
      where: { purchaseId: serialPurchaseId }
    })

    assert(serialNumbers.length === 3, 'Create GRN with Serials', `3 serial numbers created (got ${serialNumbers.length})`)

    for (const sn of serialNumbers) {
      assert(sn.status === 'in_stock', 'Create GRN with Serials', `Serial ${sn.serialNumber} status is "in_stock"`)
      assert(sn.condition === 'new', 'Create GRN with Serials', `Serial ${sn.serialNumber} condition is "new"`)
      assert(sn.currentLocationId === testData.locationId, 'Create GRN with Serials', `Serial ${sn.serialNumber} at correct location`)
    }
  } else {
    assert(false, 'Create GRN with Serials', 'Failed - no GRN ID returned')
  }
}

// Test 5: Validation - Over-receiving
async function testOverReceiving() {
  console.log('\n=== TEST 5: VALIDATION - OVER-RECEIVING ===')

  // Create PO for 10 items
  const poData = {
    locationId: testData.locationId,
    supplierId: testData.supplierId,
    purchaseDate: '2025-01-06',
    items: [
      {
        productId: testData.productId,
        productVariationId: testData.variationId,
        quantity: 10,
        unitCost: 100.00,
      }
    ],
  }

  const poResponse = await makeRequest('POST', '/api/purchases', poData)
  if (poResponse.status !== 201) return

  const purchaseId = poResponse.data.id
  const purchaseItemId = poResponse.data.items[0].id

  // Try to receive 15 items
  const grnData = {
    receiptDate: '2025-01-06',
    items: [
      {
        purchaseItemId: purchaseItemId,
        quantityReceived: 15,
      }
    ],
  }

  const response = await makeRequest('POST', `/api/purchases/${purchaseId}/receive`, grnData)

  assert(response.status === 400, 'Over-receiving Validation', `Status is 400 (got ${response.status})`)
  assert(response.data.error && response.data.error.includes('Cannot receive more than ordered'), 'Over-receiving Validation', 'Error message is correct')
}

// Test 6: Validation - Serial Number Mismatch
async function testSerialMismatch() {
  console.log('\n=== TEST 6: VALIDATION - SERIAL NUMBER MISMATCH ===')

  // Create PO
  const poData = {
    locationId: testData.locationId,
    supplierId: testData.supplierId,
    purchaseDate: '2025-01-06',
    items: [
      {
        productId: testData.serialProductId,
        productVariationId: testData.serialVariationId,
        quantity: 3,
        unitCost: 500.00,
        requiresSerial: true,
      }
    ],
  }

  const poResponse = await makeRequest('POST', '/api/purchases', poData)
  if (poResponse.status !== 201) return

  const purchaseId = poResponse.data.id
  const purchaseItemId = poResponse.data.items[0].id

  // Try to receive with only 2 serial numbers (should be 3)
  const grnData = {
    receiptDate: '2025-01-06',
    items: [
      {
        purchaseItemId: purchaseItemId,
        quantityReceived: 3,
        serialNumbers: [
          { serialNumber: 'SN-001', condition: 'new' },
          { serialNumber: 'SN-002', condition: 'new' },
        ]
      }
    ],
  }

  const response = await makeRequest('POST', `/api/purchases/${purchaseId}/receive`, grnData)

  assert(response.status === 400, 'Serial Mismatch Validation', `Status is 400 (got ${response.status})`)
  assert(response.data.error && response.data.error.includes('Serial number count mismatch'), 'Serial Mismatch Validation', 'Error message is correct')
}

// Test 7: Duplicate Serial Number Detection
async function testDuplicateSerial() {
  console.log('\n=== TEST 7: VALIDATION - DUPLICATE SERIAL NUMBER ===')

  const timestamp = Date.now()
  const serialNumber = `SN-DUPLICATE-${timestamp}`

  // First PO
  const poData1 = {
    locationId: testData.locationId,
    supplierId: testData.supplierId,
    purchaseDate: '2025-01-06',
    items: [
      {
        productId: testData.serialProductId,
        productVariationId: testData.serialVariationId,
        quantity: 1,
        unitCost: 500.00,
        requiresSerial: true,
      }
    ],
  }

  const poResponse1 = await makeRequest('POST', '/api/purchases', poData1)
  if (poResponse1.status !== 201) return

  // Receive with serial number
  const grnData1 = {
    receiptDate: '2025-01-06',
    items: [
      {
        purchaseItemId: poResponse1.data.items[0].id,
        quantityReceived: 1,
        serialNumbers: [{ serialNumber: serialNumber, condition: 'new' }]
      }
    ],
  }

  await makeRequest('POST', `/api/purchases/${poResponse1.data.id}/receive`, grnData1)

  // Second PO with same serial
  const poData2 = {
    locationId: testData.locationId,
    supplierId: testData.supplierId,
    purchaseDate: '2025-01-06',
    items: [
      {
        productId: testData.serialProductId,
        productVariationId: testData.serialVariationId,
        quantity: 1,
        unitCost: 500.00,
        requiresSerial: true,
      }
    ],
  }

  const poResponse2 = await makeRequest('POST', '/api/purchases', poData2)
  if (poResponse2.status !== 201) return

  const grnData2 = {
    receiptDate: '2025-01-06',
    items: [
      {
        purchaseItemId: poResponse2.data.items[0].id,
        quantityReceived: 1,
        serialNumbers: [{ serialNumber: serialNumber, condition: 'new' }]
      }
    ],
  }

  const response = await makeRequest('POST', `/api/purchases/${poResponse2.data.id}/receive`, grnData2)

  assert(response.status === 400, 'Duplicate Serial Detection', `Status is 400 (got ${response.status})`)
  assert(response.data.error && response.data.error.includes('already exists'), 'Duplicate Serial Detection', 'Error message is correct')
}

// Main test runner
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   PURCHASES MODULE - COMPREHENSIVE TESTING                  ║')
  console.log('║   Financial System - ZERO TOLERANCE FOR ERRORS              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  try {
    await setupTestData()
    await testLogin()
    await testCreatePO()
    await testCreateGRN()
    await testCreateGRNWithSerials()
    await testOverReceiving()
    await testSerialMismatch()
    await testDuplicateSerial()
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message)
    console.error(error.stack)
    testResults.failed++
  } finally {
    await cleanup()
  }

  // Print final results
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║   TEST RESULTS                                               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`\n✓ PASSED: ${testResults.passed}`)
  console.log(`✗ FAILED: ${testResults.failed}`)
  console.log(`TOTAL: ${testResults.passed + testResults.failed}`)

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - System is stable and accurate!')
  } else {
    console.log('\n⚠️  FAILURES DETECTED - Review issues above')
    console.log('\nFailed tests:')
    testResults.tests.filter(t => t.status === 'FAILED').forEach(t => {
      console.log(`  - ${t.name}: ${t.message}`)
    })
  }

  process.exit(testResults.failed > 0 ? 1 : 0)
}

runAllTests()
