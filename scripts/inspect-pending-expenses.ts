import { prisma } from '../src/lib/prisma'
async function main() {
  const exps = await prisma.expense.findMany({
    where: { businessId: 1, status: 'draft' },
    select: { id: true, referenceNumber: true, amount: true, paymentMethod: true,
              payeeName: true, categoryId: true, glAccountId: true, expenseDate: true },
  })
  for (const e of exps) console.log(JSON.stringify(e, null, 2))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
