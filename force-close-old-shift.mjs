import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function forceCloseOldShift() {
  try {
    console.log('\n=== FORCE CLOSING OLD SHIFT ===\n')

    // Find the unclosed shift from Nov 6, 2025
    const shift = await prisma.shift.findFirst({
      where: {
        status: 'open',
        openedAt: {
          lt: new Date() // Opened before now
        }
      },
      orderBy: {
        openedAt: 'asc' // Get the oldest one
      }
    })

    if (!shift) {
      console.log('❌ No open shifts found')
      return
    }

    console.log(`✅ Found open shift:`)
    console.log(`   Shift Number: ${shift.shiftNumber}`)
    console.log(`   Opened At: ${shift.openedAt}`)
    console.log(`   Location ID: ${shift.locationId}`)
    console.log(`   Beginning Cash: ₱${shift.beginningCash}`)

    // Close the shift
    const closedShift = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        endingCash: shift.beginningCash, // Set ending = beginning (no transactions)
        cashDifference: 0, // No difference
        closingNotes: 'Force closed by admin - old shift from previous day'
      }
    })

    console.log(`\n✅ Shift force-closed successfully!`)
    console.log(`   Status: ${closedShift.status}`)
    console.log(`   Closed At: ${closedShift.closedAt}`)
    console.log(`\n💡 You can now open a new shift at the POS`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

forceCloseOldShift()
