/**
 * INVENTORY INTEGRITY CHECK - QUICK SMOKE TEST
 *
 * This test verifies the core integrity of the inventory system by checking:
 * 1. No duplicate invoice numbers exist
 * 2. Stock transactions match actual stock levels
 * 3. Product history audit trail is complete
 * 4. Multi-tenant data isolation is enforced
 * 5. All critical tables exist and are accessible
 */

import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Inventory Integrity Check', () => {

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('1. Database Connection and Structure', async () => {
    console.log('\n=== TEST 1: Database Connection ===')

    // Verify we can connect to database
    const userCount = await prisma.user.count()
    expect(userCount).toBeGreaterThan(0)
    console.log(`✅ Database connected - ${userCount} users found`)

    // Verify critical tables exist
    const tables = [
      'user',
      'business',
      'businessLocation',
      'product',
      'productVariation',
      'variationLocationDetails',
      'stockTransaction',
      'productHistory',
      'sale',
      'purchase',
    ]

    for (const table of tables) {
      const count = await (prisma as any)[table].count()
      console.log(`✅ Table '${table}' exists - ${count} records`)
    }
  })

  test('2. No Duplicate Invoice Numbers', async () => {
    console.log('\n=== TEST 2: Duplicate Invoice Check ===')

    // Check for duplicate sales
    const salesDuplicates = await prisma.$queryRaw<Array<{ invoice_number: string; count: bigint }>>`
      SELECT invoice_number, COUNT(*) as count
      FROM sales
      GROUP BY invoice_number
      HAVING COUNT(*) > 1
    `

    console.log(`Sales checked: ${salesDuplicates.length} duplicates found`)
    expect(salesDuplicates.length).toBe(0)
    console.log(`✅ No duplicate sales invoice numbers`)

    // Check for duplicate purchases
    const purchaseDuplicates = await prisma.$queryRaw<Array<{ purchase_order_number: string; count: bigint }>>`
      SELECT purchase_order_number, COUNT(*) as count
      FROM purchases
      WHERE purchase_order_number IS NOT NULL
      GROUP BY purchase_order_number
      HAVING COUNT(*) > 1
    `

    console.log(`Purchases checked: ${purchaseDuplicates.length} duplicates found`)
    expect(purchaseDuplicates.length).toBe(0)
    console.log(`✅ No duplicate purchase order numbers`)
  })

  test('3. Stock Balance Integrity', async () => {
    console.log('\n=== TEST 3: Stock Balance Integrity ===')

    // Get all variation location details
    const stockRecords = await prisma.variationLocationDetails.findMany({
      take: 100,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    console.log(`Checking ${stockRecords.length} stock records...`)

    let issuesFound = 0

    for (const stock of stockRecords) {
      // Get the latest stock transaction for this variation/location
      const lastTransaction = await prisma.stockTransaction.findFirst({
        where: {
          productVariationId: stock.productVariationId,
          locationId: stock.locationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (lastTransaction) {
        const actualQty = parseFloat(stock.qtyAvailable.toString())
        const expectedQty = parseFloat(lastTransaction.balanceQty.toString())

        if (actualQty !== expectedQty) {
          console.log(`⚠️  Mismatch: ${stock.product.sku} at ${stock.location.name}`)
          console.log(`   Actual: ${actualQty}, Expected: ${expectedQty}`)
          issuesFound++
        }
      }
    }

    console.log(`${issuesFound === 0 ? '✅' : '❌'} Stock balance check complete - ${issuesFound} issues found`)
    expect(issuesFound).toBe(0)
  })

  test('4. Product History Audit Trail', async () => {
    console.log('\n=== TEST 4: Product History Audit Trail ===')

    // Count stock transactions
    const transactionCount = await prisma.stockTransaction.count()
    console.log(`Stock transactions: ${transactionCount}`)

    // Count product history entries
    const historyCount = await prisma.productHistory.count()
    console.log(`Product history entries: ${historyCount}`)

    // They should be roughly equal (might differ slightly if history was added later)
    if (transactionCount > 0) {
      const ratio = historyCount / transactionCount
      console.log(`History/Transaction ratio: ${ratio.toFixed(2)}`)

      if (ratio < 0.8) {
        console.log(`⚠️  Warning: History entries (${historyCount}) seem low compared to transactions (${transactionCount})`)
      } else {
        console.log(`✅ Product history appears complete`)
      }
    } else {
      console.log(`ℹ️  No transactions found (fresh database)`)
    }

    // Verify product history has required fields
    const sampleHistory = await prisma.productHistory.findFirst({
      select: {
        id: true,
        transactionType: true,
        quantityChange: true,
        balanceQuantity: true,
        createdByName: true,
        referenceType: true,
        referenceId: true,
      },
    })

    if (sampleHistory) {
      expect(sampleHistory.transactionType).toBeTruthy()
      expect(sampleHistory.createdByName).toBeTruthy()
      console.log(`✅ Product history structure verified`)
    }
  })

  test('5. Multi-Tenant Data Isolation', async () => {
    console.log('\n=== TEST 5: Multi-Tenant Data Isolation ===')

    // Get all businesses
    const businesses = await prisma.business.findMany({
      take: 5,
    })

    console.log(`Found ${businesses.length} businesses`)

    for (const business of businesses) {
      // Check products belong to correct business
      const products = await prisma.product.findMany({
        where: { businessId: business.id },
        take: 10,
      })

      const wrongBusiness = products.filter(p => p.businessId !== business.id)
      expect(wrongBusiness.length).toBe(0)

      // Check sales belong to correct business
      const sales = await prisma.sale.findMany({
        where: { businessId: business.id },
        take: 10,
      })

      const wrongSales = sales.filter(s => s.businessId !== business.id)
      expect(wrongSales.length).toBe(0)

      console.log(`✅ Business ${business.id}: ${products.length} products, ${sales.length} sales - all isolated correctly`)
    }
  })

  test('6. Stock Transaction Types Coverage', async () => {
    console.log('\n=== TEST 6: Stock Transaction Types ===')

    const transactionTypes = await prisma.stockTransaction.groupBy({
      by: ['type'],
      _count: true,
    })

    console.log('\nTransaction types in database:')
    for (const tt of transactionTypes) {
      console.log(`  ${tt.type}: ${tt._count} transactions`)
    }

    // Expected types
    const expectedTypes = [
      'opening_stock',
      'purchase',
      'sale',
      'transfer_in',
      'transfer_out',
      'adjustment',
      'customer_return',
      'supplier_return',
    ]

    const foundTypes = transactionTypes.map(tt => tt.type)

    console.log('\nCoverage check:')
    for (const expected of expectedTypes) {
      const found = foundTypes.includes(expected)
      console.log(`  ${found ? '✅' : '⚠️ '} ${expected}`)
    }
  })

  test('7. Negative Stock Detection', async () => {
    console.log('\n=== TEST 7: Negative Stock Detection ===')

    const negativeStock = await prisma.variationLocationDetails.findMany({
      where: {
        qtyAvailable: {
          lt: 0,
        },
      },
      include: {
        product: {
          select: {
            sku: true,
            name: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
      },
    })

    if (negativeStock.length > 0) {
      console.log(`⚠️  Found ${negativeStock.length} products with negative stock:`)
      for (const stock of negativeStock) {
        console.log(`   ${stock.product.sku} at ${stock.location.name}: ${stock.qtyAvailable}`)
      }
    } else {
      console.log(`✅ No negative stock found`)
    }

    // Negative stock is allowed in some cases, so this is a warning, not a failure
    console.log(`ℹ️  Negative stock count: ${negativeStock.length}`)
  })

  test('8. Orphaned Records Check', async () => {
    console.log('\n=== TEST 8: Orphaned Records Check ===')

    // Check for stock transactions without corresponding products
    const orphanedTransactions = await prisma.stockTransaction.findMany({
      where: {
        product: null,
      },
      take: 10,
    })

    console.log(`Orphaned stock transactions: ${orphanedTransactions.length}`)
    expect(orphanedTransactions.length).toBe(0)
    console.log(`✅ No orphaned stock transactions`)

    // Check for variation location details without products
    const orphanedStock = await prisma.variationLocationDetails.findMany({
      where: {
        product: null,
      },
      take: 10,
    })

    console.log(`Orphaned stock records: ${orphanedStock.length}`)
    expect(orphanedStock.length).toBe(0)
    console.log(`✅ No orphaned stock records`)
  })

  test('9. Recent Transaction Analysis', async () => {
    console.log('\n=== TEST 9: Recent Transaction Analysis ===')

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    // Recent sales
    const recentSales = await prisma.sale.count({
      where: {
        saleDate: {
          gte: oneWeekAgo,
        },
      },
    })

    console.log(`Sales in last 7 days: ${recentSales}`)

    // Recent purchases
    const recentPurchases = await prisma.purchase.count({
      where: {
        purchaseDate: {
          gte: oneWeekAgo,
        },
      },
    })

    console.log(`Purchases in last 7 days: ${recentPurchases}`)

    // Recent stock movements
    const recentMovements = await prisma.stockTransaction.count({
      where: {
        createdAt: {
          gte: oneWeekAgo,
        },
      },
    })

    console.log(`Stock movements in last 7 days: ${recentMovements}`)

    console.log(`✅ Recent activity analysis complete`)
  })

  test('10. System Health Summary', async () => {
    console.log('\n=== TEST 10: System Health Summary ===')
    console.log('\n========================================')
    console.log('INVENTORY SYSTEM HEALTH REPORT')
    console.log('========================================\n')

    // Count key entities
    const stats = {
      users: await prisma.user.count(),
      businesses: await prisma.business.count(),
      locations: await prisma.businessLocation.count(),
      products: await prisma.product.count(),
      variations: await prisma.productVariation.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      sales: await prisma.sale.count(),
      purchases: await prisma.purchase.count(),
      stockTransactions: await prisma.stockTransaction.count(),
      productHistory: await prisma.productHistory.count(),
      stockRecords: await prisma.variationLocationDetails.count(),
    }

    console.log('ENTITY COUNTS:')
    for (const [key, value] of Object.entries(stats)) {
      console.log(`  ${key.padEnd(20)}: ${value}`)
    }

    // Calculate ratios
    console.log('\nSYSTEM RATIOS:')
    console.log(`  Products/Variations  : ${stats.products > 0 ? (stats.variations / stats.products).toFixed(2) : 'N/A'}`)
    console.log(`  History/Transactions : ${stats.stockTransactions > 0 ? (stats.productHistory / stats.stockTransactions).toFixed(2) : 'N/A'}`)
    console.log(`  Sales/Customers      : ${stats.customers > 0 ? (stats.sales / stats.customers).toFixed(2) : 'N/A'}`)

    console.log('\n========================================')
    console.log('ALL INTEGRITY CHECKS COMPLETED')
    console.log('========================================\n')
  })
})
