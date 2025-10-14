const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testGRNQuery() {
  try {
    const where = {
      businessId: 1,
      locationId: { in: [2] }
    }

    console.log('Testing GRN query with includes...\n')

    const receipts = await prisma.purchaseReceipt.findMany({
      where,
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        purchase: {
          select: {
            id: true,
            purchaseOrderNumber: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            quantityReceived: true,
          },
        },
      },
    })

    console.log('✓ Query succeeded! Found', receipts.length, 'receipts')
    console.log('Receipts:', JSON.stringify(receipts, null, 2))

    process.exit(0)
  } catch (error) {
    console.error('✗ Error:', error.message)
    console.error('Error type:', error.constructor.name)
    console.error('Full error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testGRNQuery()
