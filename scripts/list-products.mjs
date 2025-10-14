import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    include: {
      variations: {
        include: {
          variationLocationDetails: true,
          stockTransactions: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log(`Found ${products.length} products\n`)

  products.forEach(p => {
    console.log(`\n=== Product: "${p.name}" (ID: ${p.id}) ===`)
    console.log(`SKU: ${p.sku}`)
    console.log(`Type: ${p.type}`)
    console.log(`Created: ${p.createdAt}`)
    console.log(`\nVariations (${p.variations.length}):`)

    p.variations.forEach(v => {
      console.log(`\n  Variation ID ${v.id}: "${v.name}"`)
      console.log(`    SKU: ${v.sku}`)
      console.log(`    Purchase: ${v.purchasePrice}, Selling: ${v.sellingPrice}`)
      console.log(`    Is Default: ${v.isDefault}`)
      console.log(`    Deleted: ${v.deletedAt ? 'Yes' : 'No'}`)

      console.log(`    Location Details (${v.variationLocationDetails.length}):`)
      v.variationLocationDetails.forEach(d => {
        console.log(`      Location ${d.locationId}: Qty = ${d.qtyAvailable}`)
      })

      console.log(`    Stock Transactions (${v.stockTransactions.length}):`)
      v.stockTransactions.forEach(t => {
        console.log(`      ${t.type}: Qty ${t.quantity}, Balance ${t.balanceQty}`)
      })
    })
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
