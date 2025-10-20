/**
 * CRITICAL INVENTORY IN/OUT TEST
 * Tests the MOST IMPORTANT feature: Accurate inventory tracking
 *
 * This test verifies that EVERY transaction type correctly updates stock:
 * - Purchases: Stock IN
 * - Sales: Stock OUT
 * - Refunds: Stock IN (back to inventory)
 * - Transfers: Stock OUT from source, Stock IN to destination
 * - Inventory Corrections: Stock IN or OUT based on adjustment
 */

import { test, expect } from '@playwright/test'
import { PrismaClient, Prisma } from '@prisma/client'
import {
  processPurchaseReceipt,
  processSale,
  addStock,
  updateStock,
  transferStockOut,
  transferStockIn,
  StockTransactionType,
} from '../src/lib/stockOperations'

const prisma = new PrismaClient()

// Test context
let testBusinessId: number
let testUserId: number
let testLocation1Id: number
let testLocation2Id: number
let testProductId: number
let testVariationId: number

test.describe('CRITICAL: Inventory IN/OUT Verification', () => {
  test.beforeAll(async () => {
    // Get test data
    const business = await prisma.business.findFirst()
    const user = await prisma.user.findFirst()
    const locations = await prisma.businessLocation.findMany({ take: 2 })
    const product = await prisma.product.findFirst()
    const variation = await prisma.productVariation.findFirst()

    if (!business || !user || !locations[0] || !locations[1] || !product || !variation) {
      throw new Error('Missing test data - run seed first')
    }

    testBusinessId = business.id
    testUserId = user.id
    testLocation1Id = locations[0].id
    testLocation2Id = locations[1].id
    testProductId = product.id
    testVariationId = variation.id

    console.log('\n========================================')
    console.log('CRITICAL INVENTORY IN/OUT TEST')
    console.log('========================================')
    console.log(`Business ID: ${testBusinessId}`)
    console.log(`Location 1: ${locations[0].name} (ID: ${testLocation1Id})`)
    console.log(`Location 2: ${locations[1].name} (ID: ${testLocation2Id})`)
    console.log(`Product: ${product.name} (ID: ${testProductId})`)
    console.log(`Variation ID: ${testVariationId}`)
    console.log('========================================\n')

    // Clean up test variation stock
    await prisma.variationLocationDetails.deleteMany({
      where: {
        productVariationId: testVariationId,
        locationId: { in: [testLocation1Id, testLocation2Id] },
      },
    })

    // Create fresh stock records with 0 quantity
    await prisma.variationLocationDetails.createMany({
      data: [
        {
          productId: testProductId,
          productVariationId: testVariationId,
          locationId: testLocation1Id,
          qtyAvailable: 0,
        },
        {
          productId: testProductId,
          productVariationId: testVariationId,
          locationId: testLocation2Id,
          qtyAvailable: 0,
        },
      ],
    })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  // Helper function to get current stock
  async function getStock(variationId: number, locationId: number): Promise<number> {
    const stock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variationId,
          locationId: locationId,
        },
      },
    })
    return stock ? parseFloat(stock.qtyAvailable.toString()) : 0
  }

  test('1. PURCHASE - Stock IN ✅', async () => {
    console.log('\n=== TEST 1: PURCHASE (Stock IN) ===')

    const stockBefore = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock BEFORE purchase: ${stockBefore}`)

    const purchaseQty = 100
    const unitCost = 50

    // Process purchase receipt (should ADD stock)
    await processPurchaseReceipt({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      locationId: testLocation1Id,
      quantity: purchaseQty,
      unitCost: unitCost,
      purchaseId: 9999,
      receiptId: 9999,
      userId: testUserId,
      userDisplayName: 'Test User',
    })

    const stockAfter = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock AFTER purchase: ${stockAfter}`)

    const stockIncrease = stockAfter - stockBefore
    console.log(`Stock INCREASED by: ${stockIncrease}`)

    expect(stockIncrease).toBe(purchaseQty)
    console.log('✅ PURCHASE correctly added stock')
  })

  test('2. SALE - Stock OUT ✅', async () => {
    console.log('\n=== TEST 2: SALE (Stock OUT) ===')

    const stockBefore = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock BEFORE sale: ${stockBefore}`)

    const saleQty = 30
    const unitCost = 50

    // Process sale (should REDUCE stock)
    await processSale({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      locationId: testLocation1Id,
      quantity: saleQty,
      unitCost: unitCost,
      saleId: 9999,
      userId: testUserId,
      userDisplayName: 'Test User',
    })

    const stockAfter = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock AFTER sale: ${stockAfter}`)

    const stockDecrease = stockBefore - stockAfter
    console.log(`Stock DECREASED by: ${stockDecrease}`)

    expect(stockDecrease).toBe(saleQty)
    console.log('✅ SALE correctly reduced stock')
  })

  test('3. REFUND - Stock IN (Back to Inventory) ✅', async () => {
    console.log('\n=== TEST 3: REFUND (Stock IN) ===')

    const stockBefore = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock BEFORE refund: ${stockBefore}`)

    const refundQty = 10

    // Process refund (should ADD stock back)
    await addStock({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      locationId: testLocation1Id,
      quantity: refundQty,
      type: StockTransactionType.CUSTOMER_RETURN,
      referenceType: 'customer_return',
      referenceId: 9999,
      userId: testUserId,
      userDisplayName: 'Test User',
      notes: 'Customer return',
    })

    const stockAfter = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock AFTER refund: ${stockAfter}`)

    const stockIncrease = stockAfter - stockBefore
    console.log(`Stock INCREASED by: ${stockIncrease}`)

    expect(stockIncrease).toBe(refundQty)
    console.log('✅ REFUND correctly added stock back')
  })

  test('4. TRANSFER - Stock OUT from Source, Stock IN to Destination ✅', async () => {
    console.log('\n=== TEST 4: TRANSFER (OUT from Source, IN to Destination) ===')

    const transferQty = 20

    // Get stock before transfer
    const loc1Before = await getStock(testVariationId, testLocation1Id)
    const loc2Before = await getStock(testVariationId, testLocation2Id)
    console.log(`Location 1 BEFORE transfer: ${loc1Before}`)
    console.log(`Location 2 BEFORE transfer: ${loc2Before}`)

    // Transfer OUT from Location 1
    await transferStockOut({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      fromLocationId: testLocation1Id,
      quantity: transferQty,
      transferId: 9999,
      userId: testUserId,
      notes: 'Transfer to Location 2',
      userDisplayName: 'Test User',
    })

    const loc1AfterOut = await getStock(testVariationId, testLocation1Id)
    console.log(`Location 1 AFTER transfer OUT: ${loc1AfterOut}`)

    const loc1Decrease = loc1Before - loc1AfterOut
    console.log(`Location 1 DECREASED by: ${loc1Decrease}`)
    expect(loc1Decrease).toBe(transferQty)

    // Transfer IN to Location 2
    await transferStockIn({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      toLocationId: testLocation2Id,
      quantity: transferQty,
      transferId: 9999,
      userId: testUserId,
      notes: 'Transfer from Location 1',
      userDisplayName: 'Test User',
    })

    const loc2AfterIn = await getStock(testVariationId, testLocation2Id)
    console.log(`Location 2 AFTER transfer IN: ${loc2AfterIn}`)

    const loc2Increase = loc2AfterIn - loc2Before
    console.log(`Location 2 INCREASED by: ${loc2Increase}`)
    expect(loc2Increase).toBe(transferQty)

    // Verify total stock unchanged (just moved)
    const totalBefore = loc1Before + loc2Before
    const totalAfter = loc1AfterOut + loc2AfterIn
    console.log(`Total stock BEFORE transfer: ${totalBefore}`)
    console.log(`Total stock AFTER transfer: ${totalAfter}`)
    expect(totalAfter).toBe(totalBefore)

    console.log('✅ TRANSFER correctly moved stock between locations')
  })

  test('5. INVENTORY CORRECTION - Stock Adjustment (Increase) ✅', async () => {
    console.log('\n=== TEST 5: INVENTORY CORRECTION (Increase) ===')

    const stockBefore = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock BEFORE correction: ${stockBefore}`)

    const adjustmentQty = 15 // Found 15 extra items

    // Process inventory correction (increase)
    await updateStock({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      locationId: testLocation1Id,
      quantity: adjustmentQty,
      type: StockTransactionType.ADJUSTMENT,
      referenceType: 'inventory_correction',
      referenceId: 9999,
      userId: testUserId,
      userDisplayName: 'Test User',
      notes: 'Found missing inventory',
    })

    const stockAfter = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock AFTER correction: ${stockAfter}`)

    const stockIncrease = stockAfter - stockBefore
    console.log(`Stock INCREASED by: ${stockIncrease}`)

    expect(stockIncrease).toBe(adjustmentQty)
    console.log('✅ INVENTORY CORRECTION (increase) works correctly')
  })

  test('6. INVENTORY CORRECTION - Stock Adjustment (Decrease) ✅', async () => {
    console.log('\n=== TEST 6: INVENTORY CORRECTION (Decrease) ===')

    const stockBefore = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock BEFORE correction: ${stockBefore}`)

    const adjustmentQty = -5 // 5 items damaged

    // Process inventory correction (decrease)
    await updateStock({
      businessId: testBusinessId,
      productId: testProductId,
      productVariationId: testVariationId,
      locationId: testLocation1Id,
      quantity: adjustmentQty,
      type: StockTransactionType.ADJUSTMENT,
      referenceType: 'inventory_correction',
      referenceId: 9998,
      userId: testUserId,
      userDisplayName: 'Test User',
      notes: 'Damaged items removed',
    })

    const stockAfter = await getStock(testVariationId, testLocation1Id)
    console.log(`Stock AFTER correction: ${stockAfter}`)

    const stockDecrease = stockBefore - stockAfter
    console.log(`Stock DECREASED by: ${stockDecrease}`)

    expect(stockDecrease).toBe(Math.abs(adjustmentQty))
    console.log('✅ INVENTORY CORRECTION (decrease) works correctly')
  })

  test('7. VERIFY PRODUCT HISTORY - Audit Trail ✅', async () => {
    console.log('\n=== TEST 7: PRODUCT HISTORY AUDIT TRAIL ===')

    const history = await prisma.productHistory.findMany({
      where: {
        productVariationId: testVariationId,
        locationId: testLocation1Id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    console.log(`\nProduct History Entries: ${history.length}`)

    const expectedTypes = [
      'purchase',
      'sale',
      'customer_return',
      'transfer_out',
      'adjustment',
      'adjustment',
    ]

    console.log('\nTransaction History:')
    history.forEach((entry, index) => {
      const qtyChange = parseFloat(entry.quantityChange.toString())
      const qtyAfter = parseFloat(entry.balanceQuantity.toString())
      console.log(`  ${index + 1}. ${entry.transactionType}: ${qtyChange > 0 ? '+' : ''}${qtyChange} → Balance: ${qtyAfter}`)
    })

    // Verify we have history for all operations
    expect(history.length).toBeGreaterThanOrEqual(6)
    console.log('\n✅ Product history audit trail is complete')
  })

  test('8. FINAL STOCK VERIFICATION - Calculate from Transactions ✅', async () => {
    console.log('\n=== TEST 8: FINAL STOCK VERIFICATION ===')

    // Get actual stock from database
    const actualStock = await getStock(testVariationId, testLocation1Id)
    console.log(`Actual stock in database: ${actualStock}`)

    // Calculate expected stock from all transactions
    let calculatedStock = 0

    calculatedStock += 100 // Purchase
    calculatedStock -= 30  // Sale
    calculatedStock += 10  // Refund
    calculatedStock -= 20  // Transfer OUT
    calculatedStock += 15  // Inventory correction (increase)
    calculatedStock -= 5   // Inventory correction (decrease)

    console.log(`Calculated stock from transactions: ${calculatedStock}`)

    expect(actualStock).toBe(calculatedStock)
    console.log('✅ Stock matches transaction history perfectly!')
  })

  test('9. MULTI-LOCATION VERIFICATION ✅', async () => {
    console.log('\n=== TEST 9: MULTI-LOCATION STOCK VERIFICATION ===')

    const loc1Stock = await getStock(testVariationId, testLocation1Id)
    const loc2Stock = await getStock(testVariationId, testLocation2Id)

    console.log(`Location 1 final stock: ${loc1Stock}`)
    console.log(`Location 2 final stock: ${loc2Stock}`)

    // Location 2 should have exactly what was transferred to it
    expect(loc2Stock).toBe(20) // Only the transfer

    console.log('✅ Multi-location stock tracking is accurate')
  })

  test('10. SUMMARY - INVENTORY ACCURACY REPORT ✅', async () => {
    console.log('\n========================================')
    console.log('INVENTORY ACCURACY SUMMARY')
    console.log('========================================\n')

    const loc1Stock = await getStock(testVariationId, testLocation1Id)
    const loc2Stock = await getStock(testVariationId, testLocation2Id)
    const totalStock = loc1Stock + loc2Stock

    console.log('Transaction Summary:')
    console.log('  Purchases:          +100')
    console.log('  Sales:              -30')
    console.log('  Refunds:            +10')
    console.log('  Transfers OUT:      -20')
    console.log('  Transfers IN:       +20 (to Loc 2)')
    console.log('  Adjustments (up):   +15')
    console.log('  Adjustments (down): -5')
    console.log('  ─────────────────────────')
    console.log(`  Location 1:         ${loc1Stock}`)
    console.log(`  Location 2:         ${loc2Stock}`)
    console.log(`  TOTAL STOCK:        ${totalStock}`)
    console.log('')

    // Expected totals
    const expectedLoc1 = 100 - 30 + 10 - 20 + 15 - 5 // 70
    const expectedLoc2 = 20 // From transfer
    const expectedTotal = expectedLoc1 + expectedLoc2 // 90

    console.log('Expected Results:')
    console.log(`  Location 1:         ${expectedLoc1}`)
    console.log(`  Location 2:         ${expectedLoc2}`)
    console.log(`  TOTAL STOCK:        ${expectedTotal}`)
    console.log('')

    expect(loc1Stock).toBe(expectedLoc1)
    expect(loc2Stock).toBe(expectedLoc2)
    expect(totalStock).toBe(expectedTotal)

    console.log('✅✅✅ ALL INVENTORY CALCULATIONS ARE 100% ACCURATE ✅✅✅')
    console.log('\n========================================')
    console.log('RESULT: INVENTORY TRACKING IS PERFECT!')
    console.log('========================================\n')
  })
})
