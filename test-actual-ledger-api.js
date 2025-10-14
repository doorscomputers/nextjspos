/**
 * Test the actual API call to see what it returns
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testLedgerAPI() {
  console.log('Testing Inventory Ledger API Logic...')
  console.log()

  try {
    const productId = 1 // Generic Mouse
    const variationId = 1 // Default variation
    const locationId = 2 // Main Warehouse

    // Find the LAST (most recent) APPROVED inventory correction
    console.log('Step 1: Finding last approved correction...')
    const lastCorrection = await prisma.inventoryCorrection.findFirst({
      where: {
        locationId: locationId,
        productId: productId,
        productVariationId: variationId,
        status: 'approved'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { username: true }
        }
      }
    })

    console.log('Last Correction:', lastCorrection ? {
      id: lastCorrection.id,
      createdAt: lastCorrection.createdAt,
      approvedAt: lastCorrection.approvedAt,
      physicalCount: parseFloat(lastCorrection.physicalCount.toString()),
      difference: parseFloat(lastCorrection.difference.toString()),
      reason: lastCorrection.reason
    } : 'None found')
    console.log()

    // Determine start date and baseline quantity
    let startDate
    let baselineQuantity = 0

    if (lastCorrection) {
      startDate = lastCorrection.createdAt
      baselineQuantity = parseFloat(lastCorrection.physicalCount.toString())
      console.log(`Using correction as baseline: ${baselineQuantity} units at ${startDate}`)
    } else {
      startDate = new Date(0)
      console.log('No correction found, starting from beginning of time')
    }
    console.log()

    // End date is now
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    console.log(`Date Range: ${startDate} to ${endDate}`)
    console.log()

    // Query purchase receipts
    console.log('Step 2: Querying purchase receipts in date range...')
    const purchaseReceipts = await prisma.purchaseReceipt.findMany({
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
        },
        purchase: {
          select: { purchaseOrderNumber: true }
        }
      },
      orderBy: { approvedAt: 'asc' }
    })

    console.log(`Found ${purchaseReceipts.length} receipt(s):`)
    purchaseReceipts.forEach(r => {
      console.log(`  - GRN #${r.receiptNumber}: ${r.items[0].quantityReceived} units at ${r.approvedAt}`)
    })
    console.log()

    // Calculate running balance
    console.log('Step 3: Calculating running balance...')
    let runningBalance = baselineQuantity
    console.log(`Starting Balance: ${runningBalance}`)

    const transactions = []
    for (const receipt of purchaseReceipts) {
      const item = receipt.items[0]
      const qty = parseFloat(item.quantityReceived.toString())
      runningBalance += qty

      transactions.push({
        date: receipt.approvedAt,
        type: 'Stock Received',
        qty: qty,
        balance: runningBalance
      })

      console.log(`  + ${qty} units (GRN #${receipt.receiptNumber}) = Balance: ${runningBalance}`)
    }
    console.log()
    console.log(`Final Calculated Balance: ${runningBalance}`)
    console.log()

    // Get current system inventory
    console.log('Step 4: Checking current system inventory...')
    const currentInventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: variationId,
        locationId: locationId
      },
      select: {
        qtyAvailable: true
      }
    })

    const currentSystemInventory = currentInventory
      ? parseFloat(currentInventory.qtyAvailable.toString())
      : 0

    console.log(`Current System Inventory: ${currentSystemInventory}`)
    console.log()

    // Calculate variance
    const variance = runningBalance - currentSystemInventory
    console.log('='.repeat(80))
    console.log('RECONCILIATION:')
    console.log(`  Calculated Balance: ${runningBalance}`)
    console.log(`  System Inventory:   ${currentSystemInventory}`)
    console.log(`  Variance:           ${variance}`)
    console.log(`  Status:             ${Math.abs(variance) < 0.0001 ? '✅ Matched' : '❌ Discrepancy'}`)
    console.log('='.repeat(80))
    console.log()

    // Now test what happens if we calculate opening balance correctly
    console.log('='.repeat(80))
    console.log('PROPOSED FIX: Calculate Opening Balance from transactions BEFORE start date')
    console.log('='.repeat(80))
    console.log()

    // Query ALL receipts before the start date
    console.log('Querying ALL receipts BEFORE correction date...')
    const receiptsBeforeCorrection = await prisma.purchaseReceipt.findMany({
      where: {
        locationId: locationId,
        status: 'approved',
        approvedAt: {
          lt: startDate // Less than (before) start date
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

    console.log(`Found ${receiptsBeforeCorrection.length} receipt(s) before correction date`)

    let calculatedOpeningBalance = 0
    receiptsBeforeCorrection.forEach(r => {
      const qty = parseFloat(r.items[0].quantityReceived.toString())
      calculatedOpeningBalance += qty
      console.log(`  + ${qty} units (GRN #${r.receiptNumber}) at ${r.approvedAt}`)
    })

    console.log()
    console.log(`Calculated Opening Balance: ${calculatedOpeningBalance}`)
    console.log(`Correction Physical Count: ${baselineQuantity}`)
    console.log(`Match: ${calculatedOpeningBalance === baselineQuantity ? '✅ YES' : '❌ NO'}`)
    console.log()

    if (calculatedOpeningBalance !== baselineQuantity) {
      console.log('⚠️ WARNING: Opening balance from transactions does not match correction!')
      console.log('   This could indicate:')
      console.log('   1. Stock was added/removed through other means (manual adjustments, etc.)')
      console.log('   2. Transactions before the correction exist but are not captured')
      console.log('   3. The correction was done to fix a discrepancy')
      console.log()
      console.log('   The report should use the CORRECTION physical count as truth.')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testLedgerAPI()
  .then(() => {
    console.log('Test complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
