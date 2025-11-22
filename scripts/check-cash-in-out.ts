/**
 * Diagnostic script to check cash in/out records for a shift
 * Usage: npx tsx scripts/check-cash-in-out.ts <shiftId>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCashInOut() {
  const shiftId = parseInt(process.argv[2])

  if (!shiftId || isNaN(shiftId)) {
    console.error('❌ Please provide a valid shift ID')
    console.log('Usage: npx tsx scripts/check-cash-in-out.ts <shiftId>')
    process.exit(1)
  }

  console.log(`\n🔍 Checking Cash In/Out records for Shift ID: ${shiftId}\n`)

  // Get shift with cash in/out records
  const shift = await prisma.cashierShift.findUnique({
    where: { id: shiftId },
    include: {
      cashInOutRecords: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!shift) {
    console.error(`❌ Shift ${shiftId} not found`)
    process.exit(1)
  }

  console.log(`✅ Shift Found:`)
  console.log(`   - Shift Number: ${shift.shiftNumber}`)
  console.log(`   - Status: ${shift.status}`)
  console.log(`   - Opened: ${shift.openedAt}`)
  console.log(`   - Closed: ${shift.closedAt || 'Not closed yet'}`)
  console.log(`\n📋 Cash In/Out Records (${shift.cashInOutRecords.length} total):\n`)

  if (shift.cashInOutRecords.length === 0) {
    console.log('   ⚠️  No cash in/out records found for this shift!')
  } else {
    let totalCashIn = 0
    let totalCashOut = 0

    shift.cashInOutRecords.forEach((record: any, index: number) => {
      const amount = parseFloat(record.amount.toString())
      console.log(`${index + 1}. ${record.type.toUpperCase()}`)
      console.log(`   - ID: ${record.id}`)
      console.log(`   - Type: "${record.type}"`)
      console.log(`   - Amount: ₱${amount.toFixed(2)}`)
      console.log(`   - Reason: ${record.reason}`)
      console.log(`   - Created: ${record.createdAt}`)
      console.log('')

      if (record.type === 'cash_in') {
        totalCashIn += amount
      } else if (record.type === 'cash_out') {
        totalCashOut += amount
      }
    })

    console.log(`\n💰 Totals:`)
    console.log(`   Cash In:  ₱${totalCashIn.toFixed(2)}`)
    console.log(`   Cash Out: ₱${totalCashOut.toFixed(2)}`)
    console.log(`   Net:      ₱${(totalCashIn - totalCashOut).toFixed(2)}`)
  }

  await prisma.$disconnect()
}

checkCashInOut().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
