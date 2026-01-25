/**
 * CRITICAL DATA CORRECTION SCRIPT
 *
 * This script fixes the double-void inventory bug for item 4711474261960.
 *
 * Issue: Sale #1540 was voided twice, creating duplicate records:
 *   - VoidTransaction #37 (correct)
 *   - VoidTransaction #38 (duplicate - to be deleted)
 *   - StockTransaction for sale_void #38 (duplicate - to be deleted)
 *
 * Current Main Store inventory: 2
 * Correct Main Store inventory: 1
 *
 * This script will:
 * 1. Delete the duplicate VoidTransaction #38
 * 2. Delete the duplicate StockTransaction referencing sale_void #38
 * 3. Adjust Main Store inventory from 2 to 1
 * 4. Create an audit trail entry
 *
 * RUN THIS SCRIPT BEFORE `npx prisma db push` to avoid unique constraint violation.
 */

import { prisma } from '../src/lib/prisma.simple'

async function fixDoubleVoidInventory() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('CRITICAL DATA CORRECTION: Double Void Inventory Fix')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Confirm we're operating on the right data
  console.log('Step 1: Verifying the duplicate records exist...')

  const voidTx37 = await prisma.voidTransaction.findUnique({ where: { id: 37 } })
  const voidTx38 = await prisma.voidTransaction.findUnique({ where: { id: 38 } })

  if (!voidTx37 || !voidTx38) {
    console.log('ERROR: Could not find VoidTransaction #37 or #38')
    console.log('  VoidTransaction #37:', voidTx37 ? 'Found' : 'NOT FOUND')
    console.log('  VoidTransaction #38:', voidTx38 ? 'Found' : 'NOT FOUND')
    return
  }

  // Verify both reference the same sale
  if (voidTx37.saleId !== voidTx38.saleId) {
    console.log('ERROR: VoidTransaction #37 and #38 do not reference the same sale')
    console.log(`  #37 saleId: ${voidTx37.saleId}`)
    console.log(`  #38 saleId: ${voidTx38.saleId}`)
    return
  }

  console.log(`✓ Confirmed: Both VoidTransaction #37 and #38 reference Sale #${voidTx37.saleId}`)
  console.log(`  #37 created at: ${voidTx37.createdAt.toISOString()}`)
  console.log(`  #38 created at: ${voidTx38.createdAt.toISOString()} (duplicate)`)

  // Find the duplicate stock transaction
  console.log('\nStep 2: Finding the duplicate stock transaction...')

  const duplicateStockTx = await prisma.stockTransaction.findFirst({
    where: {
      referenceType: 'sale_void',
      referenceId: 38, // References VoidTransaction #38
    },
  })

  if (!duplicateStockTx) {
    console.log('WARNING: Could not find stock transaction referencing sale_void #38')
    console.log('  This may have already been corrected or data is different than expected.')
  } else {
    console.log(`✓ Found duplicate stock transaction ID: ${duplicateStockTx.id}`)
    console.log(`  Product ID: ${duplicateStockTx.productId}`)
    console.log(`  Location ID: ${duplicateStockTx.locationId}`)
    console.log(`  Quantity added: +${duplicateStockTx.quantity}`)
    console.log(`  Balance after: ${duplicateStockTx.balanceQty}`)
  }

  // Check current inventory
  console.log('\nStep 3: Checking current inventory for product 188 at Main Store (ID: 2)...')

  const currentStock = await prisma.variationLocationDetails.findFirst({
    where: {
      productId: 188,
      locationId: 2, // Main Store
    },
  })

  if (!currentStock) {
    console.log('ERROR: Could not find stock record for product 188 at Main Store')
    return
  }

  const currentQty = parseFloat(currentStock.qtyAvailable.toString())
  console.log(`✓ Current quantity: ${currentQty}`)
  console.log(`  Expected after fix: ${currentQty - 1}`)

  // Perform the fix in a transaction
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('EXECUTING FIX (in transaction)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  await prisma.$transaction(async (tx) => {
    // 1. Delete the duplicate stock transaction
    if (duplicateStockTx) {
      console.log(`Deleting duplicate StockTransaction #${duplicateStockTx.id}...`)
      await tx.stockTransaction.delete({
        where: { id: duplicateStockTx.id },
      })
      console.log('✓ Duplicate StockTransaction deleted')
    }

    // 2. Delete the duplicate VoidTransaction
    console.log('Deleting duplicate VoidTransaction #38...')
    await tx.voidTransaction.delete({
      where: { id: 38 },
    })
    console.log('✓ Duplicate VoidTransaction #38 deleted')

    // 3. Adjust the inventory
    console.log('Adjusting inventory from', currentQty, 'to', currentQty - 1, '...')
    await tx.variationLocationDetails.update({
      where: { id: currentStock.id },
      data: {
        qtyAvailable: currentQty - 1,
      },
    })
    console.log('✓ Inventory adjusted')

    // 4. Create a correction stock transaction for audit trail
    console.log('Creating audit trail stock transaction...')
    await tx.stockTransaction.create({
      data: {
        businessId: 1,
        productId: 188,
        productVariationId: 188,
        locationId: 2, // Main Store
        type: 'adjustment',
        quantity: -1, // Removing the extra unit
        balanceQty: currentQty - 1,
        referenceType: 'correction',
        referenceId: 0, // Special reference for data correction
        createdBy: 1, // Super admin
        notes: 'DATA CORRECTION: Removed duplicate void inventory restoration. Sale #1540 was voided twice on 2025-12-27, adding +2 instead of +1. Deleting duplicate VoidTransaction #38 and stock transaction. Bug fix applied in void endpoint.',
      },
    })
    console.log('✓ Audit trail created')

    // 5. Update balance on remaining stock transactions to fix the running balance
    // This is optional but helps with data integrity
    console.log('Recalculating stock transaction balances...')

    // Get all stock transactions after the correction point
    const txsToFix = await tx.stockTransaction.findMany({
      where: {
        productId: 188,
        locationId: 2,
        createdAt: { gt: duplicateStockTx?.createdAt || new Date('2025-12-27T04:33:40.000Z') },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Update balances (reduce each by 1)
    for (const stockTx of txsToFix) {
      const oldBalance = parseFloat(stockTx.balanceQty.toString())
      await tx.stockTransaction.update({
        where: { id: stockTx.id },
        data: { balanceQty: oldBalance - 1 },
      })
      console.log(`  Updated StockTransaction #${stockTx.id} balance: ${oldBalance} → ${oldBalance - 1}`)
    }

    console.log('✓ Stock transaction balances recalculated')
  })

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('FIX COMPLETED SUCCESSFULLY')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Verify the fix
  console.log('Verifying the fix...')

  const finalStock = await prisma.variationLocationDetails.findFirst({
    where: {
      productId: 188,
      locationId: 2,
    },
  })

  const remainingVoids = await prisma.voidTransaction.findMany({
    where: { saleId: 1540 },
  })

  console.log(`✓ Final inventory for product 188 at Main Store: ${finalStock?.qtyAvailable}`)
  console.log(`✓ Number of VoidTransaction records for Sale #1540: ${remainingVoids.length}`)

  if (remainingVoids.length === 1 && parseFloat(finalStock?.qtyAvailable.toString() || '0') === currentQty - 1) {
    console.log('\n✅ DATA CORRECTION VERIFIED SUCCESSFULLY')
    console.log('   The inventory discrepancy has been fixed.')
    console.log('   You can now run `npx prisma db push` to apply the unique constraint.')
  } else {
    console.log('\n⚠️ VERIFICATION WARNING: Please check the data manually')
  }
}

fixDoubleVoidInventory()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
