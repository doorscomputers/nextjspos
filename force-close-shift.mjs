import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function forceCloseShift() {
  try {
    console.log('\n=== FORCE CLOSING OLD SHIFT ===\n')

    // Find the shift from Nov 6, 2025
    const shift = await prisma.cashShift.findFirst({
      where: {
        shiftNumber: 'SHIFT-20251106-0003',
        status: 'open'
      }
    })

    if (!shift) {
      console.log('❌ Shift not found or already closed')
      return
    }

    console.log(`✅ Found shift: ${shift.shiftNumber}`)
    console.log(`   Opened at: ${shift.openedAt}`)
    console.log(`   Location ID: ${shift.locationId}`)
    console.log(`   Beginning Cash: ₱${shift.beginningCash}`)
    console.log(`   System Cash: ₱${shift.systemCash}`)

    // Close the shift
    const closedShift = await prisma.cashShift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        endingCash: shift.systemCash, // Match system cash
        cashDifference: 0, // No difference
        closingNotes: '[FORCE-CLOSED] Old shift from previous day - BIR compliance requirement',
        closedBy: shift.openedBy, // Close by same user who opened
      }
    })

    console.log(`\n✅ Shift closed successfully!`)
    console.log(`   Closed at: ${closedShift.closedAt}`)
    console.log(`   Ending Cash: ₱${closedShift.endingCash}`)
    console.log(`   Cash Difference: ₱${closedShift.cashDifference}`)
    console.log(`\n✅ You can now open a new shift for today.`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

forceCloseShift()
