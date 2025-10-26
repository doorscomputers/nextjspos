const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const transferId = 5 // TR-202510-0005

  console.log('🔍 Checking Transfer Completion for TR-202510-0005...\n')

  // Get transfer details
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })

  console.log('📋 Transfer Status:', transfer.status)
  console.log('📍 From Location ID:', transfer.fromLocationId)
  console.log('📍 To Location ID:', transfer.toLocationId)
  console.log('📦 Items:', transfer.items.length)
  console.log('')

  // Check stock at destination for each item
  console.log('🏪 Checking Stock at Destination Location (ID:', transfer.toLocationId + '):\n')

  for (const item of transfer.items) {
    const stock = await prisma.variationLocationDetails.findFirst({
      where: {
        productId: item.productId,
        productVariationId: item.productVariationId,
        locationId: transfer.toLocationId,
      },
    })

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { name: true },
    })

    const variation = await prisma.productVariation.findUnique({
      where: { id: item.productVariationId },
      select: { name: true },
    })

    console.log(`  ${product.name} - ${variation.name}:`)
    console.log(`    Quantity in transfer: ${item.quantity}`)
    console.log(`    Current stock at destination: ${stock ? stock.qtyAvailable : '0 (no stock record)'}`)
    console.log('')
  }

  // Check stock transactions
  console.log('📊 Checking Stock Transactions for this transfer:\n')

  const stockTransactions = await prisma.stockTransaction.findMany({
    where: {
      referenceType: 'stock_transfer',
      referenceId: transferId,
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Found ${stockTransactions.length} stock transactions`)

  for (const tx of stockTransactions) {
    console.log(`  - Type: ${tx.type}, Location: ${tx.locationId}, Qty: ${tx.quantity}, Balance: ${tx.balanceQty}`)
  }
  console.log('')

  // Check product history
  console.log('📜 Checking Product History:\n')

  const productHistory = await prisma.productHistory.findMany({
    where: {
      referenceType: 'stock_transfer',
      referenceId: transferId,
    },
  })

  console.log(`Found ${productHistory.length} product history entries`)

  if (productHistory.length === 0) {
    console.log('⚠️  WARNING: No productHistory entries found! This might cause issues with Stock History V2 report.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
