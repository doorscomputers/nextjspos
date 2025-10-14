const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testDateFilter() {
  try {
    console.log('Testing date filter fix...\n')

    // This is what the frontend sends for "This Week" (10/06/2025 to 10/12/2025)
    const startDate = '2025-10-06'
    const endDate = '2025-10-12'

    console.log(`Filter range: ${startDate} to ${endDate}\n`)

    // OLD WAY (what was causing the bug)
    console.log('OLD WAY (buggy):')
    const oldStartDateTime = new Date(startDate)
    const oldEndDateTime = new Date(endDate)
    console.log(`Start: ${oldStartDateTime}`)
    console.log(`End: ${oldEndDateTime}\n`)

    const oldWhere = {
      businessId: 1,
      deletedAt: null,
      createdAt: {
        gte: oldStartDateTime,
        lte: oldEndDateTime
      }
    }

    const oldResults = await prisma.stockTransfer.count({ where: oldWhere })
    console.log(`Results found (OLD): ${oldResults}\n`)

    // NEW WAY (fixed)
    console.log('NEW WAY (fixed):')
    const newStartDateTime = new Date(startDate + 'T00:00:00')
    const newEndDateTime = new Date(endDate + 'T23:59:59.999')
    console.log(`Start: ${newStartDateTime}`)
    console.log(`End: ${newEndDateTime}\n`)

    const newWhere = {
      businessId: 1,
      deletedAt: null,
      createdAt: {
        gte: newStartDateTime,
        lte: newEndDateTime
      }
    }

    const newResults = await prisma.stockTransfer.count({ where: newWhere })
    console.log(`Results found (NEW): ${newResults}\n`)

    // Show the actual transfers
    const transfers = await prisma.stockTransfer.findMany({
      where: newWhere,
      select: {
        id: true,
        transferNumber: true,
        status: true,
        createdAt: true
      }
    })

    console.log('Transfers found with NEW filter:')
    transfers.forEach(t => {
      console.log(`  - ${t.transferNumber} (${t.status}) created at ${t.createdAt}`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDateFilter()
