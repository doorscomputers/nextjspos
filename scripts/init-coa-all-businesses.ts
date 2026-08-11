import { prisma } from '../src/lib/prisma'
import { initializeChartOfAccounts } from '../src/lib/chartOfAccounts'

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } })
  console.log(`Found ${businesses.length} business(es).`)

  for (const b of businesses) {
    const existing = await prisma.chartOfAccounts.count({ where: { businessId: b.id } })
    if (existing > 0) {
      console.log(`[skip] business ${b.id} (${b.name}) already has ${existing} accounts.`)
      continue
    }
    const created = await initializeChartOfAccounts(b.id)
    console.log(`[ok]   business ${b.id} (${b.name}) — created ${created.length} accounts.`)
  }

  const sample = await prisma.chartOfAccounts.findMany({
    where: { accountType: 'expense' },
    select: { businessId: true, accountCode: true, accountName: true },
    orderBy: [{ businessId: 'asc' }, { accountCode: 'asc' }],
  })
  console.log('\nExpense accounts now present:')
  for (const a of sample) console.log(`  biz=${a.businessId}  ${a.accountCode}  ${a.accountName}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
