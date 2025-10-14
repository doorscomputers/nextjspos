const { PrismaClient } = require('@prisma/client')
const { startOfYear, endOfYear, format } = require('date-fns')

const prisma = new PrismaClient()

async function testTrendsQuery() {
  try {
    const year = 2025
    const yearStart = startOfYear(new Date(year, 0, 1))
    const yearEnd = endOfYear(new Date(year, 0, 1))

    console.log(`Testing Transfer Trends query for year ${year}`)
    console.log(`Date range: ${format(yearStart, 'yyyy-MM-dd')} to ${format(yearEnd, 'yyyy-MM-dd')}\n`)

    // Simulate the API query
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ['verified', 'completed']
        },
        OR: [
          {
            completedAt: {
              gte: yearStart,
              lte: yearEnd
            }
          },
          {
            verifiedAt: {
              gte: yearStart,
              lte: yearEnd
            }
          }
        ]
      },
      include: {
        items: true
      },
      orderBy: [
        { completedAt: 'asc' },
        { verifiedAt: 'asc' }
      ]
    })

    console.log(`Found ${transfers.length} transfers:\n`)

    transfers.forEach((transfer, index) => {
      const effectiveDate = transfer.completedAt || transfer.verifiedAt
      console.log(`${index + 1}. ${transfer.transferNumber}`)
      console.log(`   Status: ${transfer.status}`)
      console.log(`   Effective Date: ${effectiveDate}`)
      console.log(`   Items: ${transfer.items.length}`)
      transfer.items.forEach((item, idx) => {
        console.log(`     ${idx + 1}. Product: ${item.productId}, Variation: ${item.productVariationId}, Qty: ${item.quantity}`)
      })
      console.log('')
    })

    // Get products and variations
    const productIds = new Set()
    const variationIds = new Set()

    transfers.forEach(transfer => {
      transfer.items.forEach(item => {
        productIds.add(item.productId)
        variationIds.add(item.productVariationId)
      })
    })

    console.log(`\nUnique Products: ${productIds.size}`)
    console.log(`Unique Variations: ${variationIds.size}`)

    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true, sku: true }
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, productId: true, name: true, sku: true }
    })

    console.log(`\nProducts found: ${products.length}`)
    products.forEach(p => console.log(`  - ${p.id}: ${p.name} (${p.sku})`))

    console.log(`\nVariations found: ${variations.length}`)
    variations.forEach(v => console.log(`  - ${v.id}: ${v.name} for Product ${v.productId}`))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testTrendsQuery()
