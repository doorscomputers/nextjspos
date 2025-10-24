import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function restoreInvoiceSequence() {
  try {
    // Restore the invoice sequence
    const restored = await prisma.invoiceSequence.create({
      data: {
        businessId: 1,
        year: 2025,
        month: 10,
        sequence: 1
      }
    })

    console.log('✓ Invoice sequence restored successfully:')
    console.log(restored)
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ Invoice sequence already exists, updating...')
      const updated = await prisma.invoiceSequence.updateMany({
        where: {
          businessId: 1,
          year: 2025,
          month: 10
        },
        data: {
          sequence: 1
        }
      })
      console.log('✓ Updated:', updated)
    } else {
      console.error('Error:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

restoreInvoiceSequence()
