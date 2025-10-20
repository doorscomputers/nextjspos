/**
 * Fix Missing receivedAt Timestamps on Completed Transfers
 *
 * BUG: Transfers that were completed didn't have receivedAt set
 * IMPACT: Inventory Ledger doesn't show these transfers (queries by receivedAt)
 * FIX: Set receivedAt = completedAt for all completed transfers where receivedAt is null
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixTransferReceivedAt() {
  try {
    console.log('🔍 Finding completed transfers with missing receivedAt...\n')

    // Find all completed transfers where receivedAt is null
    const transfersToFix = await prisma.stockTransfer.findMany({
      where: {
        status: 'completed',
        receivedAt: null,
        completedAt: { not: null }
      },
      select: {
        id: true,
        transferNumber: true,
        completedAt: true,
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } }
      }
    })

    console.log(`Found ${transfersToFix.length} completed transfers with missing receivedAt\n`)

    if (transfersToFix.length === 0) {
      console.log('✅ No transfers to fix. All completed transfers have receivedAt set.')
      return
    }

    // Show details
    console.log('Transfers to fix:')
    console.log('─'.repeat(100))
    transfersToFix.forEach(t => {
      console.log(`${t.transferNumber.padEnd(20)} | ${t.fromLocation?.name.padEnd(20)} → ${t.toLocation?.name.padEnd(20)} | ${t.completedAt.toISOString()}`)
    })
    console.log('─'.repeat(100))
    console.log()

    // Fix them
    console.log('🔧 Fixing transfers...\n')

    let fixedCount = 0

    for (const transfer of transfersToFix) {
      await prisma.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          receivedAt: transfer.completedAt // Set receivedAt to completedAt
        }
      })

      console.log(`✅ Fixed ${transfer.transferNumber} - receivedAt set to ${transfer.completedAt.toISOString()}`)
      fixedCount++
    }

    console.log()
    console.log('═'.repeat(100))
    console.log(`✅ SUCCESS: Fixed ${fixedCount} transfer(s)`)
    console.log('═'.repeat(100))
    console.log()
    console.log('📊 What this fixes:')
    console.log('  • Inventory Ledger will now show these transfers')
    console.log('  • Stock reconciliation will match system inventory')
    console.log('  • No more "variance" discrepancies for these products')
    console.log()

  } catch (error) {
    console.error('❌ Error fixing transfers:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixTransferReceivedAt()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
