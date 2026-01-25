import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicates() {
  console.log('=== Checking for Duplicate Cash Out Transactions ===\n')

  // Get all cash out transactions
  const cashOuts = await prisma.cashInOut.findMany({
    where: { type: 'cash_out' },
    orderBy: { createdAt: 'desc' },
    include: {
      cashierShift: { select: { shiftNumber: true, userId: true } }
    }
  })

  console.log(`Total cash_out records: ${cashOuts.length}\n`)

  // Group by potential duplicates: same shift, amount, and created within 2 seconds
  const groups: { [key: string]: typeof cashOuts } = {}

  for (const c of cashOuts) {
    // Round time to nearest 2 seconds for grouping
    const timeKey = Math.floor(new Date(c.createdAt).getTime() / 2000)
    const key = `${c.shiftId}_${Number(c.amount)}_${timeKey}`
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }

  // Find duplicates
  let duplicateCount = 0
  console.log('=== Potential Duplicate Groups ===\n')

  for (const [key, items] of Object.entries(groups)) {
    if (items.length > 1) {
      duplicateCount++
      console.log(`--- Duplicate Group ${duplicateCount} ---`)
      for (const item of items) {
        console.log(JSON.stringify({
          id: item.id,
          amount: Number(item.amount),
          userId: item.cashierShift?.userId,
          shift: item.cashierShift?.shiftNumber,
          reason: item.reason,
          createdAt: item.createdAt
        }, null, 2))
      }
      console.log('')
    }
  }

  if (duplicateCount === 0) {
    console.log('No duplicate cash_out transactions found.')
  } else {
    console.log(`\nFound ${duplicateCount} potential duplicate groups.`)
  }

  // Also show recent transactions
  console.log('\n=== 20 Most Recent Cash Out Transactions ===\n')
  for (const c of cashOuts.slice(0, 20)) {
    console.log(`ID: ${c.id} | Amount: ${Number(c.amount)} | UserID: ${c.cashierShift?.userId} | Shift: ${c.cashierShift?.shiftNumber} | Date: ${c.createdAt}`)
  }
}

checkDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
