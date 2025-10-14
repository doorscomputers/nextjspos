const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const warehouse = await prisma.businessLocation.findUnique({
    where: { id: 2 }
  })

  const mainWarehouse = await prisma.businessLocation.findUnique({
    where: { id: 100 }
  })

  console.log('=== WAREHOUSE (ID: 2) ===')
  console.log(`Name: ${warehouse?.name}\n`)

  // Check stock records
  const warehouseStock = await prisma.variationLocationDetails.count({
    where: { locationId: 2 }
  })
  console.log(`Stock records: ${warehouseStock}`)

  // Check transfers FROM this location
  const transfersFrom = await prisma.stockTransfer.count({
    where: { fromLocationId: 2 }
  })
  console.log(`Transfers FROM: ${transfersFrom}`)

  // Check transfers TO this location
  const transfersTo = await prisma.stockTransfer.count({
    where: { toLocationId: 2 }
  })
  console.log(`Transfers TO: ${transfersTo}`)

  // Check purchases
  const purchases = await prisma.purchase.count({
    where: { locationId: 2 }
  })
  console.log(`Purchases: ${purchases}`)

  // Check sales
  const sales = await prisma.sale.count({
    where: { locationId: 2 }
  })
  console.log(`Sales: ${sales}`)

  // Check user assignments
  const userAssignments = await prisma.userLocation.count({
    where: { locationId: 2 }
  })
  console.log(`User assignments: ${userAssignments}`)

  console.log('\n=== MAIN WAREHOUSE (ID: 100) ===')
  console.log(`Name: ${mainWarehouse?.name}\n`)

  // Check stock records
  const mainWarehouseStock = await prisma.variationLocationDetails.count({
    where: { locationId: 100 }
  })
  console.log(`Stock records: ${mainWarehouseStock}`)

  // Check transfers FROM this location
  const mainTransfersFrom = await prisma.stockTransfer.count({
    where: { fromLocationId: 100 }
  })
  console.log(`Transfers FROM: ${mainTransfersFrom}`)

  // Check transfers TO this location
  const mainTransfersTo = await prisma.stockTransfer.count({
    where: { toLocationId: 100 }
  })
  console.log(`Transfers TO: ${mainTransfersTo}`)

  // Check purchases
  const mainPurchases = await prisma.purchase.count({
    where: { locationId: 100 }
  })
  console.log(`Purchases: ${mainPurchases}`)

  // Check sales
  const mainSales = await prisma.sale.count({
    where: { locationId: 100 }
  })
  console.log(`Sales: ${mainSales}`)

  // Check user assignments
  const mainUserAssignments = await prisma.userLocation.count({
    where: { locationId: 100 }
  })
  console.log(`User assignments: ${mainUserAssignments}`)

  console.log('\n=== RECOMMENDATION ===')

  if (warehouseStock === 0 && transfersFrom === 0 && transfersTo === 0 && purchases === 0 && sales === 0) {
    console.log('✅ SAFE to delete "Warehouse" (ID: 2) - No data dependencies')
  } else {
    console.log('⚠️  WARNING: "Warehouse" (ID: 2) has data dependencies!')
    console.log('   Deleting it could cause issues. Consider soft-delete (set deletedAt) instead.')
  }

  if (mainWarehouseStock === 0 && mainTransfersFrom === 0 && mainTransfersTo === 0 && mainPurchases === 0 && mainSales === 0) {
    console.log('✅ SAFE to delete "Main Warehouse" (ID: 100) - No data dependencies')
  } else {
    console.log('⚠️  WARNING: "Main Warehouse" (ID: 100) has data dependencies!')
    console.log('   Deleting it could cause issues. Consider soft-delete (set deletedAt) instead.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
