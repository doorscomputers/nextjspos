const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCompletedTransfers() {
  try {
    console.log('Checking for completed transfers...\n')

    // Get all transfers with status='completed'
    const completedTransfers = await prisma.stockTransfer.findMany({
      where: {
        status: 'completed',
        deletedAt: null
      },
      include: {
        items: true
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 5
    })

    console.log(`Found ${completedTransfers.length} completed transfers:\n`)

    completedTransfers.forEach((transfer, index) => {
      console.log(`${index + 1}. Transfer ID: ${transfer.id}`)
      console.log(`   Transfer Number: ${transfer.transferNumber}`)
      console.log(`   Status: ${transfer.status}`)
      console.log(`   Completed At: ${transfer.completedAt}`)
      console.log(`   Items: ${transfer.items.length}`)
      console.log(`   -------------------------`)
    })

    // Check total count by status
    console.log('\nTransfers by status:')
    const statuses = await prisma.stockTransfer.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true
    })

    statuses.forEach(s => {
      console.log(`   ${s.status}: ${s._count}`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCompletedTransfers()
