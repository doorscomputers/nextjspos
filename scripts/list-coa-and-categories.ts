import { prisma } from '../src/lib/prisma'
async function main() {
  const businessId = 1
  const accounts = await prisma.chartOfAccounts.findMany({
    where: { businessId },
    select: { id: true, accountCode: true, accountName: true, accountType: true },
    orderBy: { accountCode: 'asc' },
  })
  console.log(`Total accounts: ${accounts.length}`)
  for (const a of accounts) console.log(`  ${a.accountCode}  ${a.accountType.padEnd(9)}  ${a.accountName}`)

  console.log('\nExpense categories:')
  const cats = await prisma.expenseCategory.findMany({
    where: { businessId },
    select: { id: true, name: true, glAccountId: true },
    orderBy: { name: 'asc' },
  })
  for (const c of cats) console.log(`  id=${c.id}  glAccountId=${c.glAccountId ?? 'NULL'}  ${c.name}`)

  console.log('\nExisting expenses status breakdown:')
  const expenses = await prisma.expense.groupBy({
    by: ['status'],
    where: { businessId },
    _count: { _all: true },
  })
  for (const e of expenses) console.log(`  ${e.status}: ${e._count._all}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
