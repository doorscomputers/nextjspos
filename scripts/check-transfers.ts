import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check what the API returns with limit 50 and no status filter
  const recent50 = await prisma.stockTransfer.findMany({
    where: { deletedAt: null },
    select: { transferNumber: true, transferDate: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  console.log('Most recent 50 transfers (API default):')
  const dates = new Set<string>()
  recent50.forEach(t => dates.add(t.transferDate.toISOString().substring(0, 10)))
  console.log('Unique dates:', Array.from(dates).sort())

  const oldest = recent50[recent50.length - 1]
  const newest = recent50[0]
  console.log('\nDate range:', oldest.transferDate.toISOString().substring(0, 10), 'to', newest.transferDate.toISOString().substring(0, 10))

  // Count by date
  const byDate: Record<string, number> = {}
  recent50.forEach(t => {
    const date = t.transferDate.toISOString().substring(0, 10)
    byDate[date] = (byDate[date] || 0) + 1
  })
  console.log('\nTransfers by date in recent 50:')
  Object.entries(byDate).sort().forEach(([d, c]) => console.log('  ' + d + ':', c))

  // Total count
  const total = await prisma.stockTransfer.count({ where: { deletedAt: null } })
  console.log('\nTotal transfers in database:', total)
  console.log('Showing:', recent50.length, '/', total)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
