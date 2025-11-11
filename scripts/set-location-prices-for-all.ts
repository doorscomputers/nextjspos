/**
 * Set location-specific unit prices for all locations
 * Based on global unit prices
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Setting location-specific unit prices for all locations\n')

  try {
    // Get all products with unit prices
    const products = await prisma.product.findMany({
      where: {
        unitPrices: {
          some: {}
        }
      },
      include: {
        unitPrices: {
          include: {
            unit: true
          }
        }
      }
    })

    console.log(`Found ${products.length} products with unit prices\n`)

    // Get all business locations
    const locations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true,
        businessId: true
      }
    })

    console.log(`Found ${locations.length} business locations\n`)

    let created = 0
    let updated = 0
    let skipped = 0

    // For each product
    for (const product of products) {
      console.log(`\n📦 Processing: ${product.name}`)

      // For each location
      for (const location of locations.filter(l => l.businessId === product.businessId)) {
        // For each unit price
        for (const unitPrice of product.unitPrices) {
          // Check if location-specific price already exists
          const existing = await prisma.productUnitLocationPrice.findUnique({
            where: {
              productId_locationId_unitId: {
                productId: product.id,
                locationId: location.id,
                unitId: unitPrice.unitId
              }
            }
          })

          if (existing) {
            // Skip if already exists (don't overwrite user-set prices)
            skipped++
            console.log(`   ⏭️  ${location.name} - ${unitPrice.unit.name}: Already exists (₱${existing.sellingPrice})`)
          } else {
            // Create location-specific price from global price
            await prisma.productUnitLocationPrice.create({
              data: {
                businessId: product.businessId,
                productId: product.id,
                locationId: location.id,
                unitId: unitPrice.unitId,
                purchasePrice: unitPrice.purchasePrice,
                sellingPrice: unitPrice.sellingPrice,
                lastUpdatedBy: 1 // System user
              }
            })
            created++
            console.log(`   ✅ ${location.name} - ${unitPrice.unit.name}: Created (₱${unitPrice.sellingPrice})`)
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Created: ${created} location-specific prices`)
    console.log(`⏭️  Skipped: ${skipped} (already existed)`)
    console.log(`📊 Total locations: ${locations.length}`)
    console.log(`📦 Total products: ${products.length}`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
