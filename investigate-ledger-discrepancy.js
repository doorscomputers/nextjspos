/**
 * Investigation Script: Inventory Ledger Discrepancy
 *
 * Investigating why Generic Mouse shows:
 * - System Inventory: 48 units
 * - Ledger Balance: 0 units
 * - Discrepancy: -48 units
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function investigate() {
  console.log('='.repeat(80))
  console.log('INVENTORY LEDGER DISCREPANCY INVESTIGATION')
  console.log('='.repeat(80))
  console.log()

  try {
    // Step 1: Find the Generic Mouse product
    console.log('Step 1: Finding Generic Mouse (PCI-0001)...')
    const product = await prisma.product.findFirst({
      where: {
        sku: 'PCI-0001'
      },
      include: {
        variations: true
      }
    })

    if (!product) {
      console.log('❌ Product not found!')
      return
    }

    console.log(`✅ Found: ${product.name} (ID: ${product.id})`)
    console.log(`   Variations: ${product.variations.length}`)
    product.variations.forEach(v => {
      console.log(`   - ${v.name} (ID: ${v.id}, SKU: ${v.sku})`)
    })
    console.log()

    const variationId = product.variations[0]?.id
    if (!variationId) {
      console.log('❌ No variation found!')
      return
    }

    // Step 2: Find Main Warehouse location
    console.log('Step 2: Finding Main Warehouse location...')
    const location = await prisma.businessLocation.findFirst({
      where: {
        name: 'Main Warehouse'
      }
    })

    if (!location) {
      console.log('❌ Main Warehouse not found!')
      return
    }

    console.log(`✅ Found: ${location.name} (ID: ${location.id})`)
    console.log()

    // Step 3: Check current system inventory
    console.log('Step 3: Checking current system inventory...')
    const currentInventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: variationId,
        locationId: location.id
      }
    })

    if (!currentInventory) {
      console.log('❌ No inventory record found!')
      return
    }

    console.log(`✅ Current System Inventory: ${currentInventory.qtyAvailable} units`)
    console.log(`   Record created at: ${currentInventory.createdAt}`)
    console.log(`   Record updated at: ${currentInventory.updatedAt}`)
    console.log()

    // Step 4: Find ALL inventory corrections for this product/location
    console.log('Step 4: Finding ALL inventory corrections...')
    const allCorrections = await prisma.inventoryCorrection.findMany({
      where: {
        productId: product.id,
        productVariationId: variationId,
        locationId: location.id
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { username: true }
        }
      }
    })

    console.log(`Found ${allCorrections.length} correction(s):`)
    if (allCorrections.length === 0) {
      console.log('   ⚠️ NO INVENTORY CORRECTIONS FOUND!')
      console.log('   This means the report will start from the beginning of time (Date(0))')
    } else {
      allCorrections.forEach((corr, idx) => {
        console.log(`   ${idx + 1}. ID: ${corr.id} | Status: ${corr.status}`)
        console.log(`      Created: ${corr.createdAt}`)
        console.log(`      Approved: ${corr.approvedAt || 'Not approved'}`)
        console.log(`      System Count: ${corr.systemCount} | Physical Count: ${corr.physicalCount}`)
        console.log(`      Difference: ${corr.difference}`)
        console.log(`      Reason: ${corr.reason}`)
        console.log()
      })
    }

    // The report uses the LAST (most recent) APPROVED correction
    const lastApprovedCorrection = allCorrections.find(c => c.status === 'approved')
    if (lastApprovedCorrection) {
      console.log(`📌 Last APPROVED correction: ID ${lastApprovedCorrection.id}`)
      console.log(`   Date: ${lastApprovedCorrection.createdAt}`)
      console.log(`   This is the START date the report will use`)
    } else {
      console.log(`⚠️ No APPROVED corrections found`)
      console.log(`   Report will start from beginning of time: ${new Date(0)}`)
    }
    console.log()

    // Step 5: Find ALL transactions that added stock (Purchase Receipts)
    console.log('Step 5: Finding ALL purchase receipts (stock additions)...')
    const allReceipts = await prisma.purchaseReceipt.findMany({
      where: {
        locationId: location.id,
        items: {
          some: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: product.id,
            productVariationId: variationId
          }
        },
        purchase: {
          select: { purchaseOrderNumber: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Found ${allReceipts.length} receipt(s):`)
    let totalReceived = 0
    allReceipts.forEach((receipt, idx) => {
      const item = receipt.items[0]
      const qty = parseFloat(item.quantityReceived.toString())
      totalReceived += qty

      console.log(`   ${idx + 1}. GRN #${receipt.receiptNumber}`)
      console.log(`      Status: ${receipt.status}`)
      console.log(`      Created: ${receipt.createdAt}`)
      console.log(`      Approved: ${receipt.approvedAt || 'Not approved'}`)
      console.log(`      Quantity: ${qty} units`)
      console.log(`      Running Total: ${totalReceived} units`)
      console.log()
    })

    console.log(`📊 Total quantity received across ALL receipts: ${totalReceived} units`)
    console.log()

    // Step 6: Find ALL sales
    console.log('Step 6: Finding ALL sales...')
    const allSales = await prisma.sale.findMany({
      where: {
        locationId: location.id,
        status: 'completed',
        items: {
          some: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Found ${allSales.length} sale(s):`)
    let totalSold = 0
    allSales.forEach((sale, idx) => {
      const item = sale.items[0]
      const qty = parseFloat(item.quantity.toString())
      totalSold += qty

      console.log(`   ${idx + 1}. Invoice #${sale.invoiceNumber}`)
      console.log(`      Created: ${sale.createdAt}`)
      console.log(`      Quantity: ${qty} units`)
      console.log(`      Running Total Sold: ${totalSold} units`)
      console.log()
    })

    console.log(`📊 Total quantity sold: ${totalSold} units`)
    console.log()

    // Step 7: Find transfers
    console.log('Step 7: Finding ALL transfers...')

    const transfersOut = await prisma.stockTransfer.findMany({
      where: {
        fromLocationId: location.id,
        status: 'completed',
        items: {
          some: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      }
    })

    const transfersIn = await prisma.stockTransfer.findMany({
      where: {
        toLocationId: location.id,
        status: 'completed',
        items: {
          some: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: {
            productId: product.id,
            productVariationId: variationId
          }
        }
      }
    })

    console.log(`Transfers Out: ${transfersOut.length}`)
    console.log(`Transfers In: ${transfersIn.length}`)
    console.log()

    // Step 8: Calculate expected balance
    console.log('='.repeat(80))
    console.log('ANALYSIS & ROOT CAUSE')
    console.log('='.repeat(80))
    console.log()

    const netFromTransactions = totalReceived - totalSold
    console.log(`Expected Balance (Received - Sold): ${totalReceived} - ${totalSold} = ${netFromTransactions} units`)
    console.log(`Current System Inventory: ${currentInventory.qtyAvailable} units`)
    console.log(`Match: ${netFromTransactions === parseFloat(currentInventory.qtyAvailable.toString()) ? '✅ YES' : '❌ NO'}`)
    console.log()

    // Step 9: Determine the root cause
    console.log('ROOT CAUSE DETERMINATION:')
    console.log()

    if (allCorrections.length === 0) {
      console.log('🔍 ISSUE IDENTIFIED:')
      console.log('   1. No inventory corrections exist for this product/location')
      console.log('   2. The report starts from Date(0) (beginning of time) as fallback')
      console.log('   3. However, the report shows "Last Inventory Correction Date" at 8:00 AM today')
      console.log('   4. This suggests the UI might be displaying incorrect information')
      console.log()
      console.log('🔧 LIKELY BUG:')
      console.log('   The report UI might be showing the createdAt timestamp of something else')
      console.log('   as "Last Inventory Correction Date" when no correction exists.')
      console.log()
      console.log('✅ EXPECTED BEHAVIOR:')
      console.log('   When no correction exists, report should show ALL transactions from')
      console.log('   the beginning, and opening balance should be 0.')
      console.log('   The transactions should then add up to the current system inventory.')
      console.log()

      if (allReceipts.length > 0) {
        const oldestReceipt = allReceipts[0]
        console.log('📅 Oldest transaction date:', oldestReceipt.createdAt)
        console.log('   The report should start from this date or earlier.')
        console.log()
      }
    } else {
      const lastApproved = allCorrections[0]
      if (lastApproved.status === 'approved') {
        console.log('🔍 ISSUE IDENTIFIED:')
        console.log(`   1. Last correction date: ${lastApproved.createdAt}`)
        console.log(`   2. Baseline quantity from correction: ${lastApproved.physicalCount}`)
        console.log('   3. Report should show transactions AFTER this date')
        console.log()

        // Check if receipts were before correction
        const receiptsAfterCorrection = allReceipts.filter(r =>
          new Date(r.createdAt) > new Date(lastApproved.createdAt)
        )

        console.log(`   Receipts AFTER correction: ${receiptsAfterCorrection.length}`)
        console.log(`   Receipts BEFORE correction: ${allReceipts.length - receiptsAfterCorrection.length}`)
        console.log()
      }
    }

    // Step 10: Check date range issue
    console.log('📅 DATE RANGE INVESTIGATION:')
    console.log()
    console.log('Checking what date the report API would use...')

    const reportStartDate = lastApprovedCorrection?.createdAt || new Date(0)
    console.log(`Report Start Date: ${reportStartDate}`)
    console.log(`Report End Date: ${new Date()} (now)`)
    console.log()

    // Check how many receipts fall in this range
    const receiptsInRange = allReceipts.filter(r => {
      const receiptDate = r.approvedAt || r.createdAt
      return receiptDate >= reportStartDate && receiptDate <= new Date()
    })

    console.log(`Receipts in report date range: ${receiptsInRange.length}`)
    if (receiptsInRange.length === 0 && allReceipts.length > 0) {
      console.log()
      console.log('🚨 CRITICAL FINDING:')
      console.log('   ALL receipts are OUTSIDE the report date range!')
      console.log('   This explains why the report shows 0 transactions.')
      console.log()
      console.log('   The report uses "Last Correction Date" as start date,')
      console.log('   but all stock was received BEFORE that date.')
      console.log()
      console.log('💡 SOLUTION:')
      console.log('   The opening balance should be the result of all transactions')
      console.log('   BEFORE the start date, not 0.')
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

investigate()
  .then(() => {
    console.log()
    console.log('='.repeat(80))
    console.log('Investigation complete!')
    console.log('='.repeat(80))
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
