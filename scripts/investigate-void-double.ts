/**
 * CRITICAL INVESTIGATION: Double Void Inventory Bug
 * Item Code: 4711474261960
 * Location: Main Store
 * Issue: Quantity shows 2 but should be 1
 *
 * This script investigates the transaction history to find the root cause.
 */

import { prisma } from '../src/lib/prisma.simple'

async function investigateVoidDouble() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('CRITICAL INVESTIGATION: Double Void Inventory Bug')
  console.log('Item Code: 4711474261960')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Find the product
  const product = await prisma.product.findFirst({
    where: {
      sku: '4711474261960',
    },
    include: {
      variations: true,
    },
  })

  if (!product) {
    console.log('❌ Product not found with SKU 4711474261960')
    return
  }

  console.log('📦 PRODUCT FOUND:')
  console.log(`   ID: ${product.id}`)
  console.log(`   Name: ${product.name}`)
  console.log(`   SKU: ${product.sku}`)
  console.log(`   Variations: ${product.variations.length}`)

  const variationIds = product.variations.map(v => v.id)
  console.log(`   Variation IDs: ${variationIds.join(', ')}\n`)

  // 2. Find Main Store location
  const mainStore = await prisma.businessLocation.findFirst({
    where: {
      businessId: product.businessId,
      name: {
        contains: 'Main',
      },
    },
  })

  if (!mainStore) {
    console.log('❌ Main Store location not found')
    return
  }

  console.log('📍 LOCATION:')
  console.log(`   ID: ${mainStore.id}`)
  console.log(`   Name: ${mainStore.name}\n`)

  // 3. Get current stock
  const currentStock = await prisma.variationLocationDetails.findMany({
    where: {
      productId: product.id,
      locationId: mainStore.id,
    },
  })

  console.log('📊 CURRENT STOCK LEVELS:')
  for (const stock of currentStock) {
    console.log(`   Variation ${stock.productVariationId}: ${stock.qtyAvailable} units`)
  }
  console.log('')

  // 4. Get ALL stock transactions for this product at this location
  const stockTransactions = await prisma.stockTransaction.findMany({
    where: {
      productId: product.id,
      locationId: mainStore.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      createdByUser: {
        select: {
          username: true,
        },
      },
    },
  })

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('📜 COMPLETE STOCK TRANSACTION HISTORY:')
  console.log('═══════════════════════════════════════════════════════════════')

  let runningTotal = 0
  for (const tx of stockTransactions) {
    const qty = parseFloat(tx.quantity.toString())
    runningTotal += qty
    const balanceQty = parseFloat(tx.balanceQty.toString())

    const mismatch = Math.abs(runningTotal - balanceQty) > 0.01 ? '⚠️ MISMATCH!' : ''

    console.log(`\n[${tx.createdAt.toISOString()}] ID: ${tx.id}`)
    console.log(`   Type: ${tx.type}`)
    console.log(`   Quantity: ${qty > 0 ? '+' : ''}${qty}`)
    console.log(`   Balance After: ${balanceQty} ${mismatch}`)
    console.log(`   Reference: ${tx.referenceType || 'N/A'} #${tx.referenceId || 'N/A'}`)
    console.log(`   Created By: ${tx.createdByUser?.username || tx.createdBy}`)
    console.log(`   Notes: ${tx.notes || 'N/A'}`)
  }

  // 5. Get ALL void transactions
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('🚫 ALL VOID TRANSACTIONS:')
  console.log('═══════════════════════════════════════════════════════════════')

  const voidTransactions = await prisma.voidTransaction.findMany({
    where: {
      locationId: mainStore.id,
      businessId: product.businessId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      sale: {
        include: {
          items: {
            where: {
              productId: product.id,
            },
          },
        },
      },
      voidedByUser: {
        select: { username: true },
      },
      approvedByUser: {
        select: { username: true },
      },
    },
  })

  let voidCount = 0
  for (const vt of voidTransactions) {
    // Only show voids that involve this product
    if (vt.sale?.items && vt.sale.items.length > 0) {
      voidCount++
      console.log(`\n[${vt.createdAt.toISOString()}] Void ID: ${vt.id}`)
      console.log(`   Sale ID: ${vt.saleId}`)
      console.log(`   Invoice: ${vt.sale?.invoiceNumber || 'N/A'}`)
      console.log(`   Reason: ${vt.voidReason}`)
      console.log(`   Original Amount: ${vt.originalAmount}`)
      console.log(`   Voided By: ${vt.voidedByUser?.username}`)
      console.log(`   Approved By: ${vt.approvedByUser?.username || 'Self'}`)
      console.log(`   Requires Manager: ${vt.requiresManagerApproval}`)
      console.log(`   Items with this product:`)
      for (const item of vt.sale.items) {
        console.log(`      - Quantity: ${item.quantity}`)
      }
    }
  }

  if (voidCount === 0) {
    console.log('   No void transactions found involving this product')
  }

  // 6. Check for duplicate void transactions on same sale
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('🔍 CHECKING FOR DUPLICATE VOIDS ON SAME SALE:')
  console.log('═══════════════════════════════════════════════════════════════')

  const allVoidsForProduct = await prisma.voidTransaction.findMany({
    where: {
      sale: {
        items: {
          some: {
            productId: product.id,
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // Group by saleId to find duplicates
  const voidsBySale: Record<number, typeof allVoidsForProduct> = {}
  for (const v of allVoidsForProduct) {
    if (!voidsBySale[v.saleId]) {
      voidsBySale[v.saleId] = []
    }
    voidsBySale[v.saleId].push(v)
  }

  for (const [saleId, voids] of Object.entries(voidsBySale)) {
    if (voids.length > 1) {
      console.log(`\n⚠️ DUPLICATE VOID DETECTED! Sale ID: ${saleId}`)
      console.log(`   Number of void records: ${voids.length}`)
      for (const v of voids) {
        console.log(`   - Void ID ${v.id} at ${v.createdAt.toISOString()}, Reason: ${v.voidReason}`)
      }
    }
  }

  // 7. Look for sale_void type transactions specifically
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('🔄 SALE VOID STOCK TRANSACTIONS (inventory restorations):')
  console.log('═══════════════════════════════════════════════════════════════')

  const voidStockTxs = await prisma.stockTransaction.findMany({
    where: {
      productId: product.id,
      locationId: mainStore.id,
      OR: [
        { type: 'sale_void' },
        { type: 'adjustment', referenceType: 'sale_void' },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      createdByUser: {
        select: { username: true },
      },
    },
  })

  for (const tx of voidStockTxs) {
    console.log(`\n[${tx.createdAt.toISOString()}] Stock Tx ID: ${tx.id}`)
    console.log(`   Type: ${tx.type}`)
    console.log(`   Reference Type: ${tx.referenceType}`)
    console.log(`   Reference ID: ${tx.referenceId}`)
    console.log(`   Quantity Added: +${tx.quantity}`)
    console.log(`   Balance After: ${tx.balanceQty}`)
    console.log(`   Created By: ${tx.createdByUser?.username}`)
    console.log(`   Notes: ${tx.notes}`)
  }

  if (voidStockTxs.length === 0) {
    console.log('   No sale void stock transactions found')
  }

  // 8. Get product history entries
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('📋 PRODUCT HISTORY ENTRIES:')
  console.log('═══════════════════════════════════════════════════════════════')

  const productHistory = await prisma.productHistory.findMany({
    where: {
      productId: product.id,
      locationId: mainStore.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  for (const ph of productHistory) {
    console.log(`\n[${ph.createdAt.toISOString()}] History ID: ${ph.id}`)
    console.log(`   Transaction Type: ${ph.transactionType}`)
    console.log(`   Quantity Change: ${parseFloat(ph.quantityChange.toString()) > 0 ? '+' : ''}${ph.quantityChange}`)
    console.log(`   Balance After: ${ph.balanceQuantity}`)
    console.log(`   Reference: ${ph.referenceType} #${ph.referenceId}`)
    console.log(`   Note: ${ph.note || 'N/A'}`)
  }

  // 9. Find sales containing this product that were voided
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('🛒 SALES WITH THIS PRODUCT (including voided):')
  console.log('═══════════════════════════════════════════════════════════════')

  const salesWithProduct = await prisma.sale.findMany({
    where: {
      items: {
        some: {
          productId: product.id,
        },
      },
      locationId: mainStore.id,
    },
    include: {
      items: {
        where: {
          productId: product.id,
        },
      },
      creator: {
        select: { username: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  })

  for (const sale of salesWithProduct) {
    console.log(`\n[${sale.createdAt.toISOString()}] Sale ID: ${sale.id}`)
    console.log(`   Invoice: ${sale.invoiceNumber}`)
    console.log(`   Status: ${sale.status} ${sale.status === 'voided' ? '🚫' : ''}`)
    console.log(`   Created By: ${sale.creator?.username}`)
    console.log(`   Items with this product:`)
    for (const item of sale.items) {
      console.log(`      - Quantity: ${item.quantity}, Variation: ${item.productVariationId}`)
    }
  }

  // 10. FINAL ANALYSIS
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('📊 FINAL ANALYSIS:')
  console.log('═══════════════════════════════════════════════════════════════')

  // Count all additions to stock
  let totalAdditions = 0
  let totalDeductions = 0

  for (const tx of stockTransactions) {
    const qty = parseFloat(tx.quantity.toString())
    if (qty > 0) {
      totalAdditions += qty
      console.log(`   + ${qty} (${tx.type}) at ${tx.createdAt.toISOString()}`)
    } else {
      totalDeductions += Math.abs(qty)
      console.log(`   - ${Math.abs(qty)} (${tx.type}) at ${tx.createdAt.toISOString()}`)
    }
  }

  const expectedBalance = totalAdditions - totalDeductions
  const actualBalance = currentStock.reduce((sum, s) => sum + parseFloat(s.qtyAvailable.toString()), 0)

  console.log(`\n   Total Additions: +${totalAdditions}`)
  console.log(`   Total Deductions: -${totalDeductions}`)
  console.log(`   Expected Balance: ${expectedBalance}`)
  console.log(`   Actual Balance: ${actualBalance}`)

  if (Math.abs(expectedBalance - actualBalance) > 0.01) {
    console.log(`\n   ⚠️ DISCREPANCY DETECTED: ${actualBalance - expectedBalance} units`)
  } else {
    console.log(`\n   ✅ Stock transactions are consistent with current balance`)
  }

  // Count void-related entries
  const voidEntries = stockTransactions.filter(
    tx => tx.type === 'sale_void' || tx.referenceType === 'sale_void'
  )
  console.log(`\n   Void-related stock entries: ${voidEntries.length}`)

  if (voidEntries.length > 1) {
    console.log(`   ⚠️ MULTIPLE VOID ENTRIES DETECTED - This may indicate double-void!`)
    for (const ve of voidEntries) {
      console.log(`      - Entry ${ve.id}: +${ve.quantity} at ${ve.createdAt.toISOString()}`)
      console.log(`        Type: ${ve.type}, Ref: ${ve.referenceType} #${ve.referenceId}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('Investigation complete.')
  console.log('═══════════════════════════════════════════════════════════════')
}

investigateVoidDouble()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
