import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllSupplierReturns() {
  console.log('🔍 Checking ALL Supplier Returns (All Statuses)...\n')

  // Get all supplier returns
  const allReturns = await prisma.supplierReturn.findMany({
    include: {
      supplier: true,
      items: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })

  // Get locations
  const locationIds = [...new Set(allReturns.map(r => r.locationId))]
  const locations = await prisma.businessLocation.findMany({
    where: { id: { in: locationIds } }
  })
  const locationMap = new Map(locations.map(l => [l.id, l]))

  // Get products
  const productIds = [...new Set(allReturns.flatMap(r => r.items.map(i => i.productId)))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } }
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  // Get variations
  const variationIds = [...new Set(allReturns.flatMap(r => r.items.map(i => i.productVariationId)))]
  const variations = await prisma.productVariation.findMany({
    where: { id: { in: variationIds } }
  })
  const variationMap = new Map(variations.map(v => [v.id, v]))

  console.log(`📦 Total Supplier Returns Found: ${allReturns.length}\n`)

  if (allReturns.length === 0) {
    console.log('❌ No supplier returns found in the database.')
    console.log('   This means you have NOT created any returns yet.')
    console.log('   To create a return:')
    console.log('   1. Go to /dashboard/supplier-returns')
    console.log('   2. Click "Create Return" or "New Return"')
    console.log('   3. Select supplier, location, products, and reason')
    console.log('   4. Submit the return')
    console.log('   5. Then APPROVE it to deduct inventory\n')
    return
  }

  // Group by status
  const byStatus = allReturns.reduce((acc: any, ret) => {
    acc[ret.status] = (acc[ret.status] || 0) + 1
    return acc
  }, {})

  console.log('📊 Returns by Status:')
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`   ${status.toUpperCase()}: ${count}`)
  }
  console.log()

  console.log('📋 Recent Returns (Last 10):\n')

  for (const ret of allReturns) {
    const location = locationMap.get(ret.locationId)
    const totalQty = ret.items.reduce((sum, item) => sum + Number(item.quantity), 0)
    const statusIcon = ret.status === 'approved' ? '✅' : '⏳'

    console.log(`${statusIcon} ${ret.returnNumber} [${ret.status.toUpperCase()}]`)
    console.log(`   Supplier: ${ret.supplier.name}`)
    console.log(`   Location: ${location?.name || 'Unknown'}`)
    console.log(`   Items: ${ret.items.length} (${totalQty} units)`)
    console.log(`   Amount: ₱${Number(ret.totalAmount).toFixed(2)}`)
    console.log(`   Reason: ${ret.returnReason}`)
    console.log(`   Created: ${new Date(ret.createdAt).toLocaleString()}`)
    if (ret.approvedAt) {
      console.log(`   Approved: ${new Date(ret.approvedAt).toLocaleString()}`)
    }
    console.log(`   URL: /dashboard/supplier-returns/${ret.id}`)

    // Show items
    console.log(`   Products:`)
    for (const item of ret.items) {
      const product = productMap.get(item.productId)
      const variation = variationMap.get(item.productVariationId)
      console.log(`     - ${product?.name || 'Unknown'}${variation ? ` (${variation.name})` : ''}: ${item.quantity} units @ ₱${Number(item.unitCost).toFixed(2)}`)

      // Check current stock
      const stockRecord = await prisma.productStock.findFirst({
        where: {
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: ret.locationId
        }
      })

      if (stockRecord) {
        console.log(`       Current Stock: ${stockRecord.quantity} units`)
      }
    }
    console.log()
  }

  // Find the most recent return to give specific advice
  if (allReturns.length > 0) {
    const latestReturn = allReturns[0]

    if (latestReturn.status === 'pending') {
      console.log('\n⚠️  ACTION REQUIRED:')
      console.log(`   Your most recent return ${latestReturn.returnNumber} is still PENDING!`)
      console.log('   Inventory has NOT been deducted yet.')
      console.log()
      console.log('   To complete the return and deduct inventory:')
      console.log(`   1. Visit: /dashboard/supplier-returns/${latestReturn.id}`)
      console.log('   2. Click the green "Approve Return" button')
      console.log('   3. Confirm the approval')
      console.log('   4. Inventory will be deducted immediately\n')
    } else if (latestReturn.status === 'approved') {
      console.log('\n✅ Your most recent return is APPROVED!')
      console.log('   Inventory was deducted when it was approved.')
      console.log(`   Approved at: ${new Date(latestReturn.approvedAt!).toLocaleString()}`)
      console.log()
      console.log('   If you\'re still seeing the wrong inventory count:')
      console.log('   1. Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)')
      console.log('   2. Check the ProductStock table in the database')
      console.log('   3. Verify the correct location is selected\n')
    }
  }

  await prisma.$disconnect()
}

checkAllSupplierReturns()
  .catch(console.error)
