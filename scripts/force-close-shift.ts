import { prisma } from '../src/lib/prisma.simple'

async function forceCloseShift() {
  console.log('🔧 Force closing shift SHIFT-20251109-0001...\n')

  try {
    // Find the shift
    const shift = await prisma.cashierShift.findFirst({
      where: {
        shiftNumber: 'SHIFT-20251109-0001',
        status: 'open'
      }
    })

    if (!shift) {
      console.log('❌ Shift not found or already closed')
      return
    }

    console.log('✅ Found shift:', shift.shiftNumber)
    console.log('   Opened:', shift.openedAt)
    console.log('   Beginning Cash: ₱', shift.beginningCash.toString())

    // Close the shift
    const closedShift = await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        endingCash: 6710.00, // From the screenshot: Current System Cash
        closingNotes: 'Force closed via script due to permission issue',
      }
    })

    console.log('\n✅ Shift closed successfully!')
    console.log('   Shift Number:', closedShift.shiftNumber)
    console.log('   Closed At:', closedShift.closedAt)
    console.log('   Ending Cash: ₱', closedShift.endingCash?.toString())

    console.log('\n📝 Now refresh the browser page (F5) and you should be able to use the system normally.')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

forceCloseShift()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
