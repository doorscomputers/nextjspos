/**
 * CRITICAL DATA CORRECTION: Fix ProductHistory duplicate void entry
 *
 * The ProductHistory table has a duplicate void entry that needs to be removed:
 * - ID 8210: sale_void #37 (correct)
 * - ID 8213: sale_void #38 (DUPLICATE - to be deleted)
 *
 * This script will:
 * 1. Delete ProductHistory entry ID 8213
 * 2. Recalculate balanceQuantity for all entries after ID 8213
 */

import { prisma } from '../src/lib/prisma.simple'

async function fixProductHistory() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('CRITICAL DATA CORRECTION: Fix ProductHistory Duplicate Entry')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Step 1: Verify the duplicate entry exists
  console.log('Step 1: Verifying duplicate entry exists...')
  const duplicateEntry = await prisma.productHistory.findUnique({
    where: { id: 8213 }
  })

  if (!duplicateEntry) {
    console.log('ERROR: ProductHistory entry ID 8213 not found. It may have already been deleted.')
    return
  }

  console.log('✓ Found duplicate entry:')
  console.log(`  ID: ${duplicateEntry.id}`)
  console.log(`  Product ID: ${duplicateEntry.productId}`)
  console.log(`  Location ID: ${duplicateEntry.locationId}`)
  console.log(`  Transaction Type: ${duplicateEntry.transactionType}`)
  console.log(`  Quantity Change: +${duplicateEntry.quantityChange}`)
  console.log(`  Balance: ${duplicateEntry.balanceQuantity}`)
  console.log(`  Reference: ${duplicateEntry.referenceType} #${duplicateEntry.referenceId}`)

  // Step 2: Get all entries after the duplicate for recalculation
  console.log('\nStep 2: Finding entries that need balance recalculation...')
  const entriesAfter = await prisma.productHistory.findMany({
    where: {
      productId: 188,
      locationId: 2,
      createdAt: { gt: duplicateEntry.createdAt }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`✓ Found ${entriesAfter.length} entries after the duplicate that need recalculation`)

  // Step 3: Execute the fix in a transaction
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('EXECUTING FIX')
  console.log('═══════════════════════════════════════════════════════════════\n')

  await prisma.$transaction(async (tx) => {
    // Delete the duplicate entry
    console.log('Deleting duplicate ProductHistory entry ID 8213...')
    await tx.productHistory.delete({
      where: { id: 8213 }
    })
    console.log('✓ Duplicate entry deleted')

    // Recalculate balances for entries after the duplicate
    // Each entry's balance should be reduced by 1 (the duplicate +1 that was removed)
    console.log('\nRecalculating balances for subsequent entries...')
    for (const entry of entriesAfter) {
      const oldBalance = parseFloat(entry.balanceQuantity.toString())
      const newBalance = oldBalance - 1

      await tx.productHistory.update({
        where: { id: entry.id },
        data: { balanceQuantity: newBalance }
      })

      console.log(`  Updated ID ${entry.id}: balance ${oldBalance} → ${newBalance}`)
    }
    console.log('✓ Balances recalculated')
  })

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('FIX COMPLETED')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Step 4: Verify the fix
  console.log('Verifying the fix...')
  const updatedHistory = await prisma.productHistory.findMany({
    where: { productId: 188, locationId: 2 },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log('\nLast 5 ProductHistory entries (most recent first):')
  for (const h of updatedHistory) {
    console.log(`  [${h.createdAt.toISOString().slice(0, 19)}] ${h.transactionType} | Bal: ${h.balanceQuantity}`)
  }

  const lastEntry = updatedHistory[0]
  if (lastEntry && parseFloat(lastEntry.balanceQuantity.toString()) === 1) {
    console.log('\n✅ SUCCESS: ProductHistory now shows correct balance of 1')
  } else {
    console.log('\n⚠️ WARNING: Please verify the balance manually')
  }
}

fixProductHistory().catch(console.error).finally(() => prisma.$disconnect())
