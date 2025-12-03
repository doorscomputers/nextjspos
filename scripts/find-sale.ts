import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function find() {
  const sale = await prisma.sale.findFirst({
    where: {
      discountAmount: { gte: 13408, lte: 13409 },
      totalAmount: { gte: 18590, lte: 18591 },
    },
    include: {
      location: { select: { name: true } },
      creator: { select: { username: true, firstName: true, lastName: true } },
      customer: { select: { name: true } },
      payments: true,
    }
  })

  if (sale) {
    console.log('=== Found Sale ===')
    console.log('Invoice Number:', sale.invoiceNumber)
    console.log('Sale Date:', sale.saleDate)
    console.log('Created At:', sale.createdAt)
    console.log('Status:', sale.status)
    console.log('Sale Type:', sale.saleType)
    console.log('Location:', sale.location?.name)
    console.log('Cashier:', sale.creator?.firstName, sale.creator?.lastName, '(' + sale.creator?.username + ')')
    console.log('Customer:', sale.customer?.name || 'Walk-in')
    console.log('Subtotal:', sale.subtotal?.toString())
    console.log('Discount:', sale.discountAmount?.toString())
    console.log('Discount Type:', sale.discountType)
    console.log('Total:', sale.totalAmount?.toString())
    console.log('Payments:', sale.payments?.length)
    sale.payments?.forEach(p => {
      console.log('  -', p.method, ':', p.amount?.toString())
    })
  } else {
    console.log('Sale not found')
  }

  await prisma.$disconnect()
}

find().catch(console.error)
