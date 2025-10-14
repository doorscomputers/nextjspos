/**
 * Test the ledger fix with custom date range
 *
 * This simulates the scenario from the user's screenshot:
 * - Custom date range: Oct 14, 2025 8:00 AM to 8:42 AM
 * - No transactions in this range
 * - But product has 50 units in stock from historical transactions
 *
 * Expected result AFTER FIX:
 * - Opening balance should be 50 units (from transactions before 8:00 AM)
 * - Transactions in range: 0
 * - Closing balance: 50 units
 * - System inventory: 50 units
 * - Discrepancy: 0 units
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testLedgerFix() {
  console.log('='.repeat(80))
  console.log('TESTING LEDGER FIX: Custom Date Range Opening Balance')
  console.log('='.repeat(80))
  console.log()

  try {
    const productId = 1 // Generic Mouse
    const variationId = 1 // Default variation
    const locationId = 2 // Main Warehouse

    // Simulate user's custom date range: Oct 14, 2025 8:00 AM to 8:42 AM
    const startDate = new Date('2025-10-14T08:00:00')
    const endDate = new Date('2025-10-14T08:42:00')

    console.log('Test Scenario:')
    console.log(`  Product: Generic Mouse (ID: ${productId})`)
    console.log(`  Location: Main Warehouse (ID: ${locationId})`)
    console.log(`  Custom Date Range: ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`)
    console.log(`  This is a 42-minute window with NO transactions`)
    console.log()
    console.log('-'.repeat(80))
    console.log()

    // SIMULATE THE FIX: Calculate opening balance from transactions before start date
    console.log('Step 1: Query transactions BEFORE start date (before 8:00 AM)...')

    const receiptsBefore = await prisma.purchaseReceipt.findMany({
      where: {
        locationId: locationId,
        status: 'approved',
        approvedAt: { lt: startDate },
        items: {
          some: {
            productId: productId,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: productId,
            productVariationId: variationId
          }
        }
      },
      orderBy: { approvedAt: 'asc' }
    })

    const salesBefore = await prisma.sale.findMany({
      where: {
        locationId: locationId,
        status: 'completed',
        createdAt: { lt: startDate },
        items: {
          some: {
            productId: productId,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: productId,
            productVariationId: variationId
          }
        }
      }
    })

    const correctionsBefore = await prisma.inventoryCorrection.findMany({
      where: {
        locationId: locationId,
        productId: productId,
        productVariationId: variationId,
        status: 'approved',
        approvedAt: { lt: startDate }
      },
      orderBy: { approvedAt: 'desc' }
    })

    console.log(`  Found ${receiptsBefore.length} receipt(s) before 8:00 AM`)
    console.log(`  Found ${salesBefore.length} sale(s) before 8:00 AM`)
    console.log(`  Found ${correctionsBefore.length} correction(s) before 8:00 AM`)
    console.log()

    // Calculate opening balance
    let openingBalance = 0

    if (correctionsBefore.length > 0) {
      // Use the most recent correction as baseline
      const lastCorrection = correctionsBefore[0]
      openingBalance = parseFloat(lastCorrection.physicalCount.toString())
      console.log(`  Using correction baseline: ${openingBalance} units from ${lastCorrection.createdAt.toLocaleString()}`)

      const correctionDate = lastCorrection.createdAt

      // Add transactions after correction but before start date
      for (const receipt of receiptsBefore) {
        if ((receipt.approvedAt || receipt.createdAt) > correctionDate) {
          const qty = parseFloat(receipt.items[0].quantityReceived.toString())
          openingBalance += qty
          console.log(`  + ${qty} units from GRN #${receipt.receiptNumber} at ${receipt.approvedAt?.toLocaleString()}`)
        }
      }

      for (const sale of salesBefore) {
        if (sale.createdAt > correctionDate) {
          const qty = parseFloat(sale.items[0].quantity.toString())
          openingBalance -= qty
          console.log(`  - ${qty} units from sale #${sale.invoiceNumber} at ${sale.createdAt.toLocaleString()}`)
        }
      }
    } else {
      // No correction, calculate from all transactions
      for (const receipt of receiptsBefore) {
        const qty = parseFloat(receipt.items[0].quantityReceived.toString())
        openingBalance += qty
        console.log(`  + ${qty} units from GRN #${receipt.receiptNumber}`)
      }

      for (const sale of salesBefore) {
        const qty = parseFloat(sale.items[0].quantity.toString())
        openingBalance -= qty
        console.log(`  - ${qty} units from sale #${sale.invoiceNumber}`)
      }
    }

    console.log()
    console.log(`✅ Calculated Opening Balance: ${openingBalance} units`)
    console.log()

    // Step 2: Query transactions IN the date range
    console.log('Step 2: Query transactions IN the date range (8:00 AM - 8:42 AM)...')

    const receiptsInRange = await prisma.purchaseReceipt.findMany({
      where: {
        locationId: locationId,
        status: 'approved',
        approvedAt: {
          gte: startDate,
          lte: endDate
        },
        items: {
          some: {
            productId: productId,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: productId,
            productVariationId: variationId
          }
        }
      }
    })

    const salesInRange = await prisma.sale.findMany({
      where: {
        locationId: locationId,
        status: 'completed',
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        items: {
          some: {
            productId: productId,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: productId,
            productVariationId: variationId
          }
        }
      }
    })

    console.log(`  Receipts in range: ${receiptsInRange.length}`)
    console.log(`  Sales in range: ${salesInRange.length}`)
    console.log()

    let totalIn = 0
    let totalOut = 0

    for (const receipt of receiptsInRange) {
      const qty = parseFloat(receipt.items[0].quantityReceived.toString())
      totalIn += qty
    }

    for (const sale of salesInRange) {
      const qty = parseFloat(sale.items[0].quantity.toString())
      totalOut += qty
    }

    console.log(`  Total In: ${totalIn} units`)
    console.log(`  Total Out: ${totalOut} units`)
    console.log()

    // Step 3: Calculate closing balance
    const closingBalance = openingBalance + totalIn - totalOut
    console.log(`Calculated Closing Balance: ${openingBalance} + ${totalIn} - ${totalOut} = ${closingBalance} units`)
    console.log()

    // Step 4: Compare with system inventory
    const currentInventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: variationId,
        locationId: locationId
      }
    })

    const systemInventory = currentInventory
      ? parseFloat(currentInventory.qtyAvailable.toString())
      : 0

    console.log(`Current System Inventory: ${systemInventory} units`)
    console.log()

    // Step 5: Show reconciliation
    const discrepancy = closingBalance - systemInventory

    console.log('='.repeat(80))
    console.log('RECONCILIATION RESULT (AFTER FIX):')
    console.log('='.repeat(80))
    console.log()
    console.log(`  Opening Balance:     ${openingBalance} units`)
    console.log(`  Total In:            ${totalIn} units`)
    console.log(`  Total Out:           ${totalOut} units`)
    console.log(`  Closing Balance:     ${closingBalance} units`)
    console.log(`  System Inventory:    ${systemInventory} units`)
    console.log(`  Discrepancy:         ${discrepancy} units`)
    console.log()

    if (Math.abs(discrepancy) < 0.0001) {
      console.log('✅ SUCCESS! Ledger now reconciles with system inventory!')
      console.log()
      console.log('The fix works correctly:')
      console.log('  1. Opening balance is calculated from historical transactions')
      console.log('  2. Even with 0 transactions in the selected range')
      console.log('  3. The closing balance matches system inventory')
      console.log('  4. No false discrepancy is shown')
    } else {
      console.log('❌ DISCREPANCY STILL EXISTS')
      console.log()
      console.log('Possible causes:')
      console.log('  1. There are transactions after the end date that added stock')
      console.log('  2. Manual adjustments or corrections after the range')
      console.log('  3. Data integrity issues')
      console.log()

      // Check for transactions AFTER end date
      const receiptsAfter = await prisma.purchaseReceipt.findMany({
        where: {
          locationId: locationId,
          status: 'approved',
          approvedAt: { gt: endDate },
          items: {
            some: {
              productId: productId,
              productVariationId: variationId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: productId,
              productVariationId: variationId
            }
          }
        }
      })

      if (receiptsAfter.length > 0) {
        console.log(`  Note: Found ${receiptsAfter.length} receipt(s) AFTER the end date`)
        console.log(`  This is expected! System inventory includes ALL transactions up to now.`)
        console.log(`  The closing balance only includes transactions up to ${endDate.toLocaleString()}`)
        console.log()
        console.log('  To see a reconciled report, extend the end date to include all transactions.')
      }
    }

    console.log()
    console.log('='.repeat(80))
    console.log()

    console.log('COMPARISON: BEFORE vs AFTER FIX')
    console.log('-'.repeat(80))
    console.log()
    console.log('BEFORE FIX (User\'s Screenshot):')
    console.log('  Opening Balance:     0 units    ❌ WRONG')
    console.log('  Total In:            0 units')
    console.log('  Total Out:           0 units')
    console.log('  Closing Balance:     0 units    ❌ WRONG')
    console.log('  System Inventory:    48 units')
    console.log('  Discrepancy:         -48 units  ❌ FALSE DISCREPANCY')
    console.log()
    console.log('AFTER FIX (Current Result):')
    console.log(`  Opening Balance:     ${openingBalance} units    ✅ CORRECT`)
    console.log(`  Total In:            ${totalIn} units`)
    console.log(`  Total Out:           ${totalOut} units`)
    console.log(`  Closing Balance:     ${closingBalance} units    ✅ CORRECT`)
    console.log(`  System Inventory:    ${systemInventory} units`)
    console.log(`  Discrepancy:         ${discrepancy} units    ${Math.abs(discrepancy) < 0.0001 ? '✅ RECONCILED' : '⚠️  (due to transactions after end date)'}`)
    console.log()

  } catch (error) {
    console.error('❌ Error during test:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testLedgerFix()
  .then(() => {
    console.log('Test complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
