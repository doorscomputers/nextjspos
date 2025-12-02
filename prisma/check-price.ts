import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  console.log('=== Checking SKU 4894947088827 ===\n')
  
  // 1. Check current price
  const variation = await prisma.productVariation.findFirst({
    where: { sku: '4894947088827' },
    include: { product: { select: { name: true } } }
  })
  
  if (variation) {
    console.log('Product:', variation.product?.name)
    console.log('Current Selling Price:', variation.defaultSellingPrice?.toString())
    console.log('Last Updated:', variation.updatedAt)
  } else {
    console.log('SKU not found!')
    await prisma.$disconnect()
    return
  }
  
  // 2. Check price history
  console.log('\n=== Recent Price History ===')
  const history = await prisma.productHistory.findMany({
    where: { sku: '4894947088827' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { createdBy: { select: { username: true } } }
  })
  
  if (history.length === 0) {
    console.log('No history found')
  } else {
    history.forEach(h => {
      console.log(`  ${h.eventType}: ${h.oldSellingPrice} -> ${h.newSellingPrice} by ${h.createdBy?.username} at ${h.createdAt}`)
    })
  }
  
  // 3. Check location prices
  console.log('\n=== Location Prices ===')
  const locPrices = await prisma.locationPrice.findMany({
    where: { productVariationId: variation.id },
    include: { location: { select: { name: true } } }
  })
  
  if (locPrices.length === 0) {
    console.log('No location-specific prices (using default)')
  } else {
    locPrices.forEach(lp => {
      console.log(`  ${lp.location?.name}: ${lp.sellingPrice}`)
    })
  }
  
  await prisma.$disconnect()
}

check().catch(console.error)
