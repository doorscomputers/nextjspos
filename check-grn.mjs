import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const grn = await prisma.purchaseReceipt.findMany({
    where: { receiptNumber: 'GRN-202510-0001' },
    include: { items: true }
  })

  console.log('=== GRN-202510-0001 ===')
  console.log(JSON.stringify(grn, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
