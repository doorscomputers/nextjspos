const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTransferDates() {
  try {
    console.log('Checking transfer dates...\n')

    const transfers = await prisma.stockTransfer.findMany({
      where: {
        deletedAt: null
      },
      select: {
        id: true,
        transferNumber: true,
        status: true,
        createdAt: true,
        sentAt: true,
        arrivedAt: true,
        verifiedAt: true,
        completedAt: true,
        businessId: true,
        transferDate: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`Found ${transfers.length} transfers:\n`)

    transfers.forEach(transfer => {
      console.log(`Transfer ID: ${transfer.id}`)
      console.log(`Transfer Number: ${transfer.transferNumber}`)
      console.log(`Status: ${transfer.status}`)
      console.log(`Business ID: ${transfer.businessId}`)
      console.log(`Transfer Date: ${transfer.transferDate || 'null'}`)
      console.log(`Created At: ${transfer.createdAt}`)
      console.log(`Sent At: ${transfer.sentAt || 'null'}`)
      console.log(`Arrived At: ${transfer.arrivedAt || 'null'}`)
      console.log(`Verified At: ${transfer.verifiedAt || 'null'}`)
      console.log(`Completed At: ${transfer.completedAt || 'null'}`)
      console.log('---')
    })

    // Check what "This Week" range would be
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday
    endOfWeek.setHours(23, 59, 59, 999)

    console.log(`\n"This Week" range would be:`)
    console.log(`Start: ${startOfWeek}`)
    console.log(`End: ${endOfWeek}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTransferDates()
