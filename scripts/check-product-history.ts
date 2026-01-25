import { prisma } from '../src/lib/prisma.simple'

async function check() {
  const history = await prisma.productHistory.findMany({
    where: { productId: 188, locationId: 2 },
    orderBy: { createdAt: 'asc' }
  })

  console.log('ProductHistory entries for Product 188 at Main Store:\n')
  for (const h of history) {
    const change = parseFloat(h.quantityChange.toString())
    const balance = parseFloat(h.balanceQuantity.toString())
    console.log(
      h.createdAt.toISOString().slice(0, 19),
      '|', h.transactionType.padEnd(12),
      '|', (change > 0 ? '+' : '') + change.toString().padStart(3),
      '| Bal:', balance,
      '| Ref:', h.referenceType || '-', '#' + (h.referenceId || '-'),
      '|', (h.note || '').slice(0, 50)
    )
  }

  if (history.length > 0) {
    console.log('\nLast Balance:', history[history.length - 1].balanceQuantity.toString())
  }

  // Check for void-related entries
  console.log('\n=== VOID-RELATED ENTRIES ===')
  const voidEntries = history.filter(h =>
    h.note?.toLowerCase().includes('void') ||
    h.referenceType === 'sale_void' ||
    h.referenceType === 'void'
  )
  console.log('Count:', voidEntries.length)
  for (const v of voidEntries) {
    console.log('  ID:', v.id, '| Change:', v.quantityChange.toString(), '| Ref:', v.referenceType, '#' + v.referenceId)
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
