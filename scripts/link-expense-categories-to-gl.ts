import { prisma } from '../src/lib/prisma'

// Map category name keywords → GL account code
const mapping: Array<{ match: RegExp; code: string; label: string }> = [
  { match: /internet|utility|utilities|electric|water|phone|telecom/i, code: '5400', label: 'Utilities Expense' },
  { match: /rent|lease/i, code: '5300', label: 'Rent Expense' },
  { match: /salary|salaries|wage|payroll/i, code: '5500', label: 'Salaries and Wages' },
  { match: /advert|marketing|promo/i, code: '5600', label: 'Advertising and Marketing' },
  { match: /office|supplies|stationery/i, code: '5700', label: 'Office Supplies' },
  { match: /bank\s*fee|bank\s*charge/i, code: '5950', label: 'Bank Fees' },
  { match: /interest/i, code: '5900', label: 'Interest Expense' },
  { match: /depreciat/i, code: '5800', label: 'Depreciation Expense' },
]
const DEFAULT_CODE = '5700' // Office Supplies fallback — safe generic bucket

async function main() {
  const businessId = 1
  const accounts = await prisma.chartOfAccounts.findMany({
    where: { businessId, accountType: 'expense' },
    select: { id: true, accountCode: true, accountName: true },
  })
  const byCode = new Map(accounts.map(a => [a.accountCode, a]))

  const cats = await prisma.expenseCategory.findMany({
    where: { businessId },
    select: { id: true, name: true, glAccountId: true },
  })

  for (const c of cats) {
    if (c.glAccountId) {
      console.log(`[skip] "${c.name}" already linked to glAccountId=${c.glAccountId}`)
      continue
    }
    let chosen = mapping.find(m => m.match.test(c.name))
    const code = chosen?.code ?? DEFAULT_CODE
    const acct = byCode.get(code)
    if (!acct) { console.log(`[err]  No account with code ${code} for "${c.name}"`); continue }
    await prisma.expenseCategory.update({
      where: { id: c.id },
      data: { glAccountId: acct.id },
    })
    console.log(`[ok]   "${c.name}" → ${acct.accountCode} ${acct.accountName}`)
  }

  console.log('\nFinal category → GL mapping:')
  const after = await prisma.expenseCategory.findMany({
    where: { businessId },
    select: { name: true, glAccount: { select: { accountCode: true, accountName: true } } },
  })
  for (const c of after) console.log(`  ${c.name}  →  ${c.glAccount?.accountCode} ${c.glAccount?.accountName}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
