import { PrismaClient } from '@prisma/client'
import { getVariationStockHistory } from '../src/lib/stock-history.ts'

const prisma = new PrismaClient()

async function main() {
  console.log('Testing stock history function...\n')

  // Get the test product we just created
  const product = await prisma.product.findFirst({
    where: { name: 'Test Product via Script' },
    include: {
      variations: {
        include: {
          variationLocationDetails: true
        }
      }
    }
  })

  if (!product) {
    console.log('Test product not found')
    return
  }

  console.log(`Product: ${product.name} (ID: ${product.id})`)
  console.log(`Variations: ${product.variations.length}`)

  const variation = product.variations[0]
  console.log(`Variation: ${variation.name} (ID: ${variation.id})`)

  const locationDetail = variation.variationLocationDetails[0]
  console.log(`Location: ${locationDetail.locationId}`)
  console.log(`Quantity: ${locationDetail.qtyAvailable}`)

  // Get stock history
  const history = await getVariationStockHistory(
    product.id,
    variation.id,
    locationDetail.locationId,
    product.businessId
  )

  console.log(`\nStock History Entries: ${history.length}`)
  history.forEach(entry => {
    console.log(`\n- ID: ${entry.id}`)
    console.log(`  Type: ${entry.transactionTypeLabel}`)
    console.log(`  Quantity Added: ${entry.quantityAdded}`)
    console.log(`  Quantity Removed: ${entry.quantityRemoved}`)
    console.log(`  Running Balance: ${entry.runningBalance}`)
    console.log(`  Date: ${entry.date}`)
    console.log(`  Created By: ${entry.createdBy}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
