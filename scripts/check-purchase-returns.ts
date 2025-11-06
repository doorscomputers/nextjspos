import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPurchaseReturns() {
  console.log('🔍 Checking PURCHASE RETURNS (from GRN)...\n')

  const purchaseReturns = await prisma.purchaseReturn.findMany({
    include: {
      supplier: true,
      purchaseReceipt: true,
      items: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })

  console.log(`📦 Purchase Returns Found: ${purchaseReturns.length}\n`)

  if (purchaseReturns.length === 0) {
    console.log('❌ No purchase returns found.')
    console.log('   This confirms the return creation failed or there is an error.\n')
    return
  }

  console.log('✅ Found Purchase Returns!\n')

  for (const ret of purchaseReturns) {
    const totalQty = ret.items.reduce((sum, item) => sum + Number(item.quantityReturned), 0)
    const statusIcon = ret.status === 'approved' ? '✅' : '⏳'

    console.log(`${statusIcon} ${ret.returnNumber} [${ret.status.toUpperCase()}]`)
    console.log(`   Supplier: ${ret.supplier.name}`)
    console.log(`   GRN: ${ret.purchaseReceipt.receiptNumber}`)
    console.log(`   Items: ${ret.items.length} (${totalQty} units returned)`)
    console.log(`   Total: ₱${Number(ret.totalAmount).toFixed(2)}`)
    console.log(`   Reason: ${ret.returnReason}`)
    console.log(`   Expected Action: ${ret.expectedAction}`)
    console.log(`   Created: ${new Date(ret.createdAt).toLocaleString()}`)
    if (ret.approvedAt) {
      console.log(`   Approved: ${new Date(ret.approvedAt).toLocaleString()}`)
    }
    console.log(`   URL: /dashboard/purchases/returns/${ret.id}`)
    console.log()
  }

  console.log('\n⚠️  IMPORTANT FINDING:')
  console.log('   Purchase Returns are SEPARATE from Supplier Returns!')
  console.log('   - Purchase Returns: Created from GRN page → View at /dashboard/purchases/returns')
  console.log('   - Supplier Returns: Created standalone → View at /dashboard/supplier-returns')
  console.log()
  console.log('   Your returns exist in the PURCHASE RETURNS table, not Supplier Returns!')

  await prisma.$disconnect()
}

checkPurchaseReturns().catch(console.error)
