import { test, expect, APIRequestContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Base URL for API calls
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000'

/**
 * COMPREHENSIVE SALES MODULE TESTING
 *
 * Testing Strategy:
 * - Zero tolerance for errors (financial system)
 * - Test all validation scenarios
 * - Verify stock deduction accuracy
 * - Verify serial number tracking
 * - Verify void/restore functionality
 * - Verify payment validation
 * - Verify RBAC permissions
 * - Verify audit trail completeness
 *
 * User Mandate: "Errors are not tolerated in a scenario where money is involved"
 */

// Helper function to ensure authentication
async function ensureAuthenticated(page: any) {
  // Check if already authenticated by trying to access dashboard
  const currentUrl = page.url()

  if (!currentUrl.includes('/dashboard')) {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`)

    // Fill login form
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'password')

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
  }
}

// Test data IDs
let testBusinessId: number
let testUserId: number
let testLocationId: number
let testCustomerId: number
let testProductId: number
let testProductVariationId: number
let testSerializedProductId: number
let testSerializedVariationId: number

// Created entity IDs for cleanup
const createdSaleIds: number[] = []
const createdCustomerIds: number[] = []
const createdProductIds: number[] = []

test.describe('Sales Module - Comprehensive Testing', () => {

  test.beforeAll(async () => {
    console.log('\n=== INITIALIZING SALES TEST ENVIRONMENT ===\n')

    // Get superadmin user
    const superadmin = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: {
        business: {
          include: {
            locations: true
          }
        }
      }
    })

    if (!superadmin || !superadmin.business) {
      throw new Error('Superadmin user not found or has no business')
    }

    testUserId = superadmin.id
    testBusinessId = superadmin.businessId!
    testLocationId = superadmin.business.locations[0]?.id

    if (!testLocationId) {
      throw new Error('No business location found')
    }

    console.log(`Business ID: ${testBusinessId}, Location ID: ${testLocationId}`)

    // Create test customer
    const customer = await prisma.customer.create({
      data: {
        businessId: testBusinessId,
        name: 'Test Customer - Sales',
        mobile: '1234567890',
        email: 'salescustomer@test.com',
      }
    })
    testCustomerId = customer.id
    createdCustomerIds.push(customer.id)
    console.log(`Created test customer ID: ${testCustomerId}`)

    // Get or create category, brand, unit
    let category = await prisma.category.findFirst({
      where: { businessId: testBusinessId, deletedAt: null }
    })
    if (!category) {
      category = await prisma.category.create({
        data: {
          businessId: testBusinessId,
          name: 'Test Category',
          shortCode: 'TEST'
        }
      })
    }

    let brand = await prisma.brand.findFirst({
      where: { businessId: testBusinessId, deletedAt: null }
    })
    if (!brand) {
      brand = await prisma.brand.create({
        data: {
          businessId: testBusinessId,
          name: 'Test Brand'
        }
      })
    }

    let unit = await prisma.unit.findFirst({
      where: { businessId: testBusinessId, deletedAt: null }
    })
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          businessId: testBusinessId,
          name: 'Piece',
          shortName: 'pc',
          allowDecimal: false
        }
      })
    }

    // Create regular product (no serial numbers)
    const regularProduct = await prisma.product.create({
      data: {
        businessId: testBusinessId,
        name: `Sales Test Product ${Date.now()}`,
        sku: `SALES-REG-${Date.now()}`,
        type: 'single',
        categoryId: category.id,
        brandId: brand.id,
        unitId: unit.id,
        enableStock: true,
        isActive: true,
      }
    })
    testProductId = regularProduct.id
    createdProductIds.push(regularProduct.id)

    // Create variation for regular product
    const regularVariation = await prisma.productVariation.create({
      data: {
        productId: regularProduct.id,
        name: 'Default',
        sku: `SALES-REG-VAR-${Date.now()}`,
        purchasePrice: 50.00,
        sellingPrice: 70.00,
      }
    })
    testProductVariationId = regularVariation.id
    console.log(`Created regular product ID: ${testProductId}, Variation ID: ${testProductVariationId}`)

    // Add opening stock for regular product
    await prisma.variationLocationDetails.create({
      data: {
        productId: testProductId,
        productVariationId: testProductVariationId,
        locationId: testLocationId,
        qtyAvailable: 100.00, // Initial stock
      }
    })
    console.log(`Added opening stock: 100 units`)

    // Create serialized product
    const serializedProduct = await prisma.product.create({
      data: {
        businessId: testBusinessId,
        name: `Sales Serial Product ${Date.now()}`,
        sku: `SALES-SERIAL-${Date.now()}`,
        type: 'single',
        categoryId: category.id,
        brandId: brand.id,
        unitId: unit.id,
        enableStock: true,
        enableProductInfo: true, // Enable for serial tracking
        isActive: true,
      }
    })
    testSerializedProductId = serializedProduct.id
    createdProductIds.push(serializedProduct.id)

    // Create variation for serialized product
    const serializedVariation = await prisma.productVariation.create({
      data: {
        productId: serializedProduct.id,
        name: 'Default',
        sku: `SALES-SERIAL-VAR-${Date.now()}`,
        purchasePrice: 800.00,
        sellingPrice: 1000.00,
      }
    })
    testSerializedVariationId = serializedVariation.id
    console.log(`Created serialized product ID: ${testSerializedProductId}, Variation ID: ${testSerializedVariationId}`)

    // Create serial numbers for testing
    const serialNumbers = []
    for (let i = 1; i <= 5; i++) {
      const sn = await prisma.productSerialNumber.create({
        data: {
          businessId: testBusinessId,
          productId: testSerializedProductId,
          productVariationId: testSerializedVariationId,
          serialNumber: `SALES-SN-${Date.now()}-${i}`,
          imei: `IMEI-${Date.now()}-${i}`,
          status: 'in_stock',
          condition: 'new',
          currentLocationId: testLocationId,
          purchaseCost: 800.00,
        }
      })
      serialNumbers.push(sn)
    }

    // Add stock for serialized product
    await prisma.variationLocationDetails.create({
      data: {
        productId: testSerializedProductId,
        productVariationId: testSerializedVariationId,
        locationId: testLocationId,
        qtyAvailable: 5.00, // 5 serial numbers
      }
    })
    console.log(`Created 5 serial numbers and added stock`)

    console.log('\n=== SALES TEST ENVIRONMENT READY ===\n')
  })

  test.afterAll(async () => {
    console.log('\n=== CLEANING UP SALES TEST DATA ===\n')

    // Delete sales
    if (createdSaleIds.length > 0) {
      await prisma.sale.deleteMany({
        where: { id: { in: createdSaleIds } }
      })
      console.log(`Deleted ${createdSaleIds.length} sales`)
    }

    // Delete customers
    if (createdCustomerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } }
      })
      console.log(`Deleted ${createdCustomerIds.length} customers`)
    }

    // Delete products
    if (createdProductIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } }
      })
      console.log(`Deleted ${createdProductIds.length} products`)
    }

    console.log('=== CLEANUP COMPLETE ===')
  })

  test('1. Prerequisites - Verify Test Data', async () => {
    console.log('\n=== TEST 1: Prerequisites ===\n')

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: testCustomerId }
    })
    expect(customer).toBeTruthy()
    expect(customer?.name).toBe('Test Customer - Sales')

    // Verify regular product has stock
    const regularStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testProductVariationId,
          locationId: testLocationId,
        }
      }
    })
    expect(regularStock).toBeTruthy()
    expect(parseFloat(regularStock!.qtyAvailable.toString())).toBe(100)

    // Verify serialized product has serial numbers
    const serialNumbers = await prisma.productSerialNumber.findMany({
      where: {
        productVariationId: testSerializedVariationId,
        status: 'in_stock'
      }
    })
    expect(serialNumbers.length).toBe(5)

    console.log('✓ All prerequisites verified')
  })

  test('2. Create Sale - Happy Path (No Serial Numbers)', async ({ page }) => {
    console.log('\n=== TEST 2: Create Sale - Happy Path ===\n')

    await ensureAuthenticated(page)

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testProductId,
            productVariationId: testProductVariationId,
            quantity: 5,
            unitPrice: 70.00,
          }
        ],
        payments: [
          {
            method: 'cash',
            amount: 350.00,
          }
        ],
        taxAmount: 0,
        discountAmount: 0,
        shippingCost: 0,
        notes: 'Test sale - regular product',
      }
    })

    expect(response.status()).toBe(201)
    const sale = await response.json()

    console.log(`Sale created: ${sale.invoiceNumber}`)
    console.log(`Total: ${sale.totalAmount}`)

    createdSaleIds.push(sale.id)

    // Verify sale data
    expect(sale.invoiceNumber).toMatch(/INV-\d{6}-\d{4}/)
    expect(sale.status).toBe('completed')
    expect(parseFloat(sale.totalAmount)).toBe(350.00)
    expect(sale.items.length).toBe(1)
    expect(sale.payments.length).toBe(1)

    // Verify stock was deducted
    const stockAfter = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testProductVariationId,
          locationId: testLocationId,
        }
      }
    })
    expect(parseFloat(stockAfter!.qtyAvailable.toString())).toBe(95) // 100 - 5

    console.log('✓ Sale created successfully')
    console.log('✓ Stock deducted correctly (100 → 95)')
  })

  test('3. Create Sale - With Serial Numbers', async ({ page }) => {
    console.log('\n=== TEST 3: Create Sale - With Serial Numbers ===\n')

    await ensureAuthenticated(page)

    // Get available serial numbers
    const availableSerials = await prisma.productSerialNumber.findMany({
      where: {
        productVariationId: testSerializedVariationId,
        status: 'in_stock',
        currentLocationId: testLocationId,
      },
      take: 2,
    })

    expect(availableSerials.length).toBe(2)
    const serialNumberIds = availableSerials.map(sn => sn.id)

    console.log(`Using serial numbers: ${availableSerials.map(sn => sn.serialNumber).join(', ')}`)

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testSerializedProductId,
            productVariationId: testSerializedVariationId,
            quantity: 2,
            unitPrice: 1000.00,
            requiresSerial: true,
            serialNumberIds,
          }
        ],
        payments: [
          {
            method: 'card',
            amount: 2000.00,
          }
        ],
        taxAmount: 0,
        discountAmount: 0,
        shippingCost: 0,
        notes: 'Test sale - serialized product',
      }
    })

    expect(response.status()).toBe(201)
    const sale = await response.json()

    console.log(`Sale created: ${sale.invoiceNumber}`)
    console.log(`Total: ${sale.totalAmount}`)

    createdSaleIds.push(sale.id)

    // Verify serial numbers marked as sold
    for (const snId of serialNumberIds) {
      const sn = await prisma.productSerialNumber.findUnique({
        where: { id: snId }
      })
      expect(sn?.status).toBe('sold')
      expect(sn?.saleId).toBe(sale.id)
      expect(sn?.soldTo).toBe('Test Customer - Sales')
      expect(sn?.soldAt).toBeTruthy()

      console.log(`✓ Serial ${sn?.serialNumber} marked as sold`)
    }

    // Verify movement records created
    const movements = await prisma.serialNumberMovement.findMany({
      where: {
        referenceType: 'sale',
        referenceId: sale.id,
      }
    })

    expect(movements.length).toBe(2)
    movements.forEach(movement => {
      expect(movement.serialNumberId).toBeGreaterThan(0) // CRITICAL: Not zero
      expect(movement.movementType).toBe('sale')
      console.log(`✓ Movement record created for serial ID: ${movement.serialNumberId}`)
    })

    // Verify stock deducted
    const stockAfter = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testSerializedVariationId,
          locationId: testLocationId,
        }
      }
    })
    expect(parseFloat(stockAfter!.qtyAvailable.toString())).toBe(3) // 5 - 2

    console.log('✓ Serial numbers tracked correctly')
    console.log('✓ Stock deducted correctly (5 → 3)')
  })

  test('4. Validation - Insufficient Stock', async ({ page }) => {
    console.log('\n=== TEST 4: Insufficient Stock Validation ===\n')

    await ensureAuthenticated(page)

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testProductId,
            productVariationId: testProductVariationId,
            quantity: 200, // More than available (95)
            unitPrice: 70.00,
            requiresSerial: false,
          }
        ],
        payments: [
          {
            method: 'cash',
            amount: 14000.00,
          }
        ],
      }
    })

    expect(response.status()).toBe(400)
    const error = await response.json()
    expect(error.error).toContain('Insufficient stock')
    expect(error.error).toContain('Available: 95')

    console.log('✓ Insufficient stock validation working')
  })

  test('5. Validation - Serial Number Count Mismatch', async ({ page }) => {
    console.log('\n=== TEST 5: Serial Number Count Mismatch ===\n')

    await ensureAuthenticated(page)

    const availableSerials = await prisma.productSerialNumber.findMany({
      where: {
        productVariationId: testSerializedVariationId,
        status: 'in_stock',
      },
      take: 1, // Get only 1 serial number
    })

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testSerializedProductId,
            productVariationId: testSerializedVariationId,
            quantity: 2, // Quantity is 2
            unitPrice: 1000.00,
            requiresSerial: true,
            serialNumberIds: availableSerials.map(sn => sn.id), // But only 1 serial number
          }
        ],
        payments: [
          {
            method: 'cash',
            amount: 2000.00,
          }
        ],
      }
    })

    expect(response.status()).toBe(400)
    const error = await response.json()
    expect(error.error).toContain('Serial number count mismatch')
    expect(error.error).toContain('Expected: 2')

    console.log('✓ Serial number count validation working')
  })

  test('6. Validation - Serial Number Not Available', async ({ page }) => {
    console.log('\n=== TEST 6: Serial Number Not Available ===\n')

    await ensureAuthenticated(page)

    // Try to use a serial number that's already sold
    const soldSerial = await prisma.productSerialNumber.findFirst({
      where: {
        productVariationId: testSerializedVariationId,
        status: 'sold',
      }
    })

    expect(soldSerial).toBeTruthy()

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testSerializedProductId,
            productVariationId: testSerializedVariationId,
            quantity: 1,
            unitPrice: 1000.00,
            requiresSerial: true,
            serialNumberIds: [soldSerial!.id], // Already sold
          }
        ],
        payments: [
          {
            method: 'cash',
            amount: 1000.00,
          }
        ],
      }
    })

    expect(response.status()).toBe(400)
    const error = await response.json()
    expect(error.error).toContain('not available for sale')

    console.log('✓ Serial number availability validation working')
  })

  test('7. Validation - Payment Total Mismatch', async ({ page }) => {
    console.log('\n=== TEST 7: Payment Total Mismatch ===\n')

    await ensureAuthenticated(page)

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testProductId,
            productVariationId: testProductVariationId,
            quantity: 5,
            unitPrice: 70.00,
          }
        ],
        payments: [
          {
            method: 'cash',
            amount: 300.00, // Should be 350
          }
        ],
      }
    })

    expect(response.status()).toBe(400)
    const error = await response.json()
    expect(error.error).toContain('Payment total')
    expect(error.error).toContain('does not match')

    console.log('✓ Payment total validation working')
  })

  test('8. Void Sale - Stock Restoration', async ({ page }) => {
    console.log('\n=== TEST 8: Void Sale and Stock Restoration ===\n')

    await ensureAuthenticated(page)

    // Get current stock before voiding
    const stockBefore = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testProductVariationId,
          locationId: testLocationId,
        }
      }
    })
    const qtyBefore = parseFloat(stockBefore!.qtyAvailable.toString())
    console.log(`Stock before void: ${qtyBefore}`)

    // Get the first sale we created
    const saleToVoid = createdSaleIds[0]
    const sale = await prisma.sale.findUnique({
      where: { id: saleToVoid },
      include: { items: true }
    })

    expect(sale).toBeTruthy()
    const quantitySold = parseFloat(sale!.items[0].quantity.toString())

    // Void the sale
    const response = await page.request.delete(`${BASE_URL}/api/sales/${saleToVoid}`)

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.message).toContain('voided')
    expect(result.message).toContain('stock restored')

    console.log(`✓ Sale ${result.invoiceNumber} voided`)

    // Verify stock was restored
    const stockAfter = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: testProductVariationId,
          locationId: testLocationId,
        }
      }
    })
    const qtyAfter = parseFloat(stockAfter!.qtyAvailable.toString())

    expect(qtyAfter).toBe(qtyBefore + quantitySold)
    console.log(`✓ Stock restored: ${qtyBefore} + ${quantitySold} = ${qtyAfter}`)

    // Verify sale status changed
    const voidedSale = await prisma.sale.findUnique({
      where: { id: saleToVoid }
    })
    expect(voidedSale?.status).toBe('voided')

    console.log('✓ Sale status changed to voided')
  })

  test('9. Void Sale - Serial Number Restoration', async ({ page }) => {
    console.log('\n=== TEST 9: Void Sale - Serial Number Restoration ===\n')

    await ensureAuthenticated(page)

    // Create a sale with serial numbers first
    const availableSerials = await prisma.productSerialNumber.findMany({
      where: {
        productVariationId: testSerializedVariationId,
        status: 'in_stock',
        currentLocationId: testLocationId,
      },
      take: 2,
    })

    const serialNumberIds = availableSerials.map(sn => sn.id)

    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testSerializedProductId,
            productVariationId: testSerializedVariationId,
            quantity: 2,
            unitPrice: 1000.00,
            requiresSerial: true,
            serialNumberIds,
          }
        ],
        payments: [
          {
            method: 'card',
            amount: 2000.00,
          }
        ],
        taxAmount: 0,
        discountAmount: 0,
        shippingCost: 0,
        notes: 'Test sale - void with serial numbers',
      }
    })

    expect(response.status()).toBe(201)
    const sale = await response.json()
    createdSaleIds.push(sale.id)

    console.log(`Created sale: ${sale.invoiceNumber}`)
    console.log(`Sale has ${serialNumberIds.length} serial numbers`)

    // Verify serial numbers are marked as sold
    for (const snId of serialNumberIds) {
      const sn = await prisma.productSerialNumber.findUnique({
        where: { id: snId }
      })
      expect(sn?.status).toBe('sold')
    }

    const initialSerialNumberIds = serialNumberIds.slice() // Copy array
    // Void the sale
    const voidResponse = await page.request.delete(`${BASE_URL}/api/sales/${sale.id}`)

    expect(voidResponse.status()).toBe(200)

    // Verify serial numbers restored
    for (const snId of initialSerialNumberIds) {
      const sn = await prisma.productSerialNumber.findUnique({
        where: { id: snId }
      })

      expect(sn?.status).toBe('in_stock')
      expect(sn?.saleId).toBeNull()
      expect(sn?.soldAt).toBeNull()
      expect(sn?.soldTo).toBeNull()
      expect(sn?.currentLocationId).toBe(testLocationId)

      console.log(`✓ Serial ${sn?.serialNumber} restored to in_stock`)
    }

    // Verify movement records created for return (sale_void, not customer_return)
    const returnMovements = await prisma.serialNumberMovement.findMany({
      where: {
        serialNumberId: { in: initialSerialNumberIds },
        movementType: 'sale_void',
        referenceId: sale.id,
      }
    })

    expect(returnMovements.length).toBe(initialSerialNumberIds.length)
    returnMovements.forEach(movement => {
      expect(movement.serialNumberId).toBeGreaterThan(0)
      console.log(`✓ Return movement created for serial ID: ${movement.serialNumberId}`)
    })

    console.log('✓ All serial numbers restored successfully')
  })

  test('10. Database Integrity - Audit Trail', async () => {
    console.log('\n=== TEST 10: Audit Trail Verification ===\n')

    // Verify audit logs exist for sales
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        businessId: testBusinessId,
        action: { in: ['sale_create', 'sale_delete'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    expect(auditLogs.length).toBeGreaterThan(0)

    console.log(`Found ${auditLogs.length} sale-related audit logs`)

    auditLogs.forEach(log => {
      // Verify required fields
      expect(log.userId).toBeTruthy()
      expect(log.username).toBeTruthy()
      expect(log.action).toBeTruthy()
      expect(log.description).toBeTruthy()
      expect(log.entityIds).toBeTruthy()

      console.log(`  ${log.action}: ${log.description}`)
    })

    console.log('✓ Audit trail complete')
  })

  test('11. Database Integrity - Stock Transactions', async ({ page }) => {
    console.log('\n=== TEST 11: Stock Transaction Records ===\n')

    await ensureAuthenticated(page)

    // Create a sale to generate stock transaction
    const response = await page.request.post(`${BASE_URL}/api/sales`, {
      data: {
        locationId: testLocationId,
        customerId: testCustomerId,
        saleDate: new Date().toISOString(),
        items: [
          {
            productId: testProductId,
            productVariationId: testProductVariationId,
            quantity: 3,
            unitPrice: 70.00,
            requiresSerial: false,
          }
        ],
        payments: [
          {
            method: 'cash',
            amount: 210.00,
          }
        ],
        taxAmount: 0,
        discountAmount: 0,
        shippingCost: 0,
        notes: 'Test sale - stock transaction verification',
      }
    })

    expect(response.status()).toBe(201)
    const sale = await response.json()
    createdSaleIds.push(sale.id)

    console.log(`Created sale: ${sale.invoiceNumber}`)

    // Verify stock transactions for sales
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        businessId: testBusinessId,
        type: 'sale',
        productVariationId: testProductVariationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    expect(stockTransactions.length).toBeGreaterThan(0)

    console.log(`Found ${stockTransactions.length} stock transactions for sales`)

    stockTransactions.forEach(tx => {
      expect(tx.productId).toBeTruthy()
      expect(tx.productVariationId).toBeTruthy()
      expect(tx.locationId).toBeTruthy()
      expect(tx.type).toBe('sale')
      expect(tx.referenceType).toBe('sale')
      expect(tx.referenceId).toBeTruthy()

      console.log(`  ${tx.referenceType} #${tx.referenceId}: Qty ${tx.quantity}`)
    })

    console.log('✓ Stock transactions recorded correctly')
  })

  test('12. Serial Number Movement Integrity', async () => {
    console.log('\n=== TEST 12: Serial Number Movement Verification ===\n')

    // Get all movements related to sales
    const saleMovements = await prisma.serialNumberMovement.findMany({
      where: {
        movementType: { in: ['sale', 'customer_return'] },
      },
      include: {
        serialNumber: {
          select: {
            serialNumber: true,
            status: true,
          }
        }
      },
      orderBy: {
        movedAt: 'desc',
      },
      take: 20,
    })

    console.log(`Found ${saleMovements.length} sale-related movements`)

    let validMovements = 0
    let invalidMovements = 0

    saleMovements.forEach(movement => {
      if (movement.serialNumberId <= 0) {
        console.error(`✗ INVALID: Movement ${movement.id} has serialNumberId: ${movement.serialNumberId}`)
        invalidMovements++
      } else {
        validMovements++
      }
    })

    console.log(`Valid movements: ${validMovements}`)
    console.log(`Invalid movements: ${invalidMovements}`)

    expect(invalidMovements).toBe(0) // CRITICAL: No invalid movements allowed

    if (invalidMovements > 0) {
      throw new Error(`CRITICAL BUG: Found ${invalidMovements} serial number movements with invalid IDs`)
    }

    console.log('✓✓✓ All serial number movements are valid')
  })

  test.skip('13. Product History - Location-Level Tracking (CRITICAL)', async () => {
    console.log('\n=== TEST 13: Product History Verification (Location-Level) ===\n')

    /**
     * CRITICAL REQUIREMENT:
     * Every stock movement MUST create a ProductHistory record showing:
     * - WHO made the change (userId)
     * - WHEN it happened (createdAt)
     * - WHAT changed (qtyBefore, qtyAfter, qtyChange)
     * - WHERE it happened (locationId)
     * - WHY it happened (transactionType, referenceType, referenceId)
     *
     * This ensures complete inventory audit trail and prevents inventory compromise
     */

    // Get all sales we created
    const sales = await prisma.sale.findMany({
      where: {
        id: { in: createdSaleIds },
        status: { not: 'voided' }, // Exclude voided sales
      },
      include: {
        items: true,
      }
    })

    console.log(`Checking Product History for ${sales.length} sales`)

    let totalHistoryRecords = 0
    let validRecords = 0
    let invalidRecords = 0

    for (const sale of sales) {
      for (const item of sale.items) {
        // Find ProductHistory records for this sale item
        const historyRecords = await prisma.productHistory.findMany({
          where: {
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: sale.locationId,
            transactionType: 'stock_out',
            referenceType: 'sale',
            referenceId: sale.id,
          },
          orderBy: {
            createdAt: 'desc',
          }
        })

        totalHistoryRecords += historyRecords.length

        if (historyRecords.length === 0) {
          console.error(`✗ MISSING: No ProductHistory for Sale ${sale.invoiceNumber}, Item ${item.productId}`)
          invalidRecords++
          continue
        }

        // Verify each history record
        for (const history of historyRecords) {
          let isValid = true

          // Check required fields
          if (!history.userId) {
            console.error(`✗ Missing userId in ProductHistory ${history.id}`)
            isValid = false
          }

          if (!history.locationId) {
            console.error(`✗ Missing locationId in ProductHistory ${history.id}`)
            isValid = false
          }

          if (!history.productId) {
            console.error(`✗ Missing productId in ProductHistory ${history.id}`)
            isValid = false
          }

          if (!history.productVariationId) {
            console.error(`✗ Missing productVariationId in ProductHistory ${history.id}`)
            isValid = false
          }

          // Verify quantity change matches
          const qtyChange = parseFloat(history.qtyChange.toString())
          const itemQuantity = parseFloat(item.quantity.toString())

          if (Math.abs(qtyChange) !== itemQuantity) {
            console.error(`✗ Quantity mismatch: History shows ${qtyChange}, Sale item has ${itemQuantity}`)
            isValid = false
          }

          // For stock_out, qtyChange should be negative
          if (history.transactionType === 'stock_out' && qtyChange >= 0) {
            console.error(`✗ Invalid qtyChange: stock_out should be negative, got ${qtyChange}`)
            isValid = false
          }

          // Verify qtyBefore and qtyAfter are logical
          const qtyBefore = parseFloat(history.qtyBefore.toString())
          const qtyAfter = parseFloat(history.qtyAfter.toString())

          if (qtyAfter !== qtyBefore + qtyChange) {
            console.error(`✗ Math error: ${qtyBefore} + ${qtyChange} ≠ ${qtyAfter}`)
            isValid = false
          }

          if (isValid) {
            validRecords++
            console.log(`✓ ProductHistory ${history.id}: ${qtyBefore} → ${qtyAfter} (${qtyChange})`)
          } else {
            invalidRecords++
          }
        }
      }
    }

    console.log(`\nTotal ProductHistory records found: ${totalHistoryRecords}`)
    console.log(`Valid records: ${validRecords}`)
    console.log(`Invalid records: ${invalidRecords}`)

    // CRITICAL: All records must be valid
    expect(invalidRecords).toBe(0)

    if (invalidRecords > 0) {
      throw new Error(`CRITICAL: Found ${invalidRecords} invalid ProductHistory records. Inventory integrity compromised!`)
    }

    // Verify void operations also create history
    const voidedSales = await prisma.sale.findMany({
      where: {
        id: { in: createdSaleIds },
        status: 'voided',
      },
      include: {
        items: true,
      }
    })

    console.log(`\nChecking Product History for ${voidedSales.length} voided sales`)

    for (const voidedSale of voidedSales) {
      for (const item of voidedSale.items) {
        const voidHistory = await prisma.productHistory.findMany({
          where: {
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: voidedSale.locationId,
            transactionType: 'stock_in',
            referenceType: 'sale_void',
            referenceId: voidedSale.id,
          }
        })

        if (voidHistory.length === 0) {
          console.error(`✗ MISSING: No void history for Sale ${voidedSale.invoiceNumber}`)
          throw new Error('CRITICAL: Void operation did not create ProductHistory record')
        }

        // For void (stock_in), qtyChange should be positive
        voidHistory.forEach(history => {
          const qtyChange = parseFloat(history.qtyChange.toString())
          if (qtyChange <= 0) {
            throw new Error(`CRITICAL: Void history has invalid qtyChange: ${qtyChange}`)
          }
          console.log(`✓ Void history created: ${history.qtyBefore} → ${history.qtyAfter} (+${qtyChange})`)
        })
      }
    }

    console.log('\n✓✓✓ Product History tracking is COMPLETE and ACCURATE')
    console.log('✓✓✓ Inventory integrity is PROTECTED')
  })
})
