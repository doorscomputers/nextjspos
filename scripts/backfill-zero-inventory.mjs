/**
 * Backfill Script: Auto-create zero inventory records
 *
 * This script ensures that every product variation has a VariationLocationDetails
 * record for every location in its business, with qtyAvailable = 0 if not already set.
 *
 * Usage: node scripts/backfill-zero-inventory.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillZeroInventory() {
  console.log('Starting zero-inventory backfill process...\n')

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true }
    })

    console.log(`Found ${businesses.length} business(es)\n`)

    let totalRecordsCreated = 0

    for (const business of businesses) {
      console.log(`Processing business: ${business.name} (ID: ${business.id})`)

      // Get all locations for this business
      const locations = await prisma.businessLocation.findMany({
        where: {
          businessId: business.id,
          deletedAt: null
        }
      })

      if (locations.length === 0) {
        console.log(`  No locations found. Skipping.\n`)
        continue
      }

      console.log(`  Found ${locations.length} location(s)`)

      // Get all product variations for this business
      const variations = await prisma.productVariation.findMany({
        where: {
          product: {
            businessId: business.id,
            deletedAt: null
          },
          deletedAt: null
        },
        include: {
          product: true
        }
      })

      if (variations.length === 0) {
        console.log(`  No products found. Skipping.\n`)
        continue
      }

      console.log(`  Found ${variations.length} product variation(s)`)

      // Get existing VariationLocationDetails for this business
      const existingRecords = await prisma.variationLocationDetails.findMany({
        where: {
          product: {
            businessId: business.id
          }
        },
        select: {
          productVariationId: true,
          locationId: true
        }
      })

      // Create a Set for quick lookup of existing records
      const existingRecordsSet = new Set(
        existingRecords.map(r => `${r.productVariationId}-${r.locationId}`)
      )

      console.log(`  Found ${existingRecords.length} existing inventory record(s)`)

      // Build list of missing records
      const missingRecords = []
      for (const location of locations) {
        for (const variation of variations) {
          const key = `${variation.id}-${location.id}`
          if (!existingRecordsSet.has(key)) {
            missingRecords.push({
              productId: variation.productId,
              productVariationId: variation.id,
              locationId: location.id,
              qtyAvailable: 0,
              sellingPrice: variation.sellingPrice
            })
          }
        }
      }

      if (missingRecords.length > 0) {
        console.log(`  Creating ${missingRecords.length} missing inventory record(s)...`)

        // Create missing records in batches of 1000
        const batchSize = 1000
        for (let i = 0; i < missingRecords.length; i += batchSize) {
          const batch = missingRecords.slice(i, i + batchSize)
          await prisma.variationLocationDetails.createMany({
            data: batch,
            skipDuplicates: true
          })
        }

        totalRecordsCreated += missingRecords.length
        console.log(`  Successfully created ${missingRecords.length} record(s)`)
      } else {
        console.log(`  No missing records. All inventory is already initialized.`)
      }

      console.log() // Empty line for readability
    }

    console.log('========================================')
    console.log(`Backfill complete!`)
    console.log(`Total records created: ${totalRecordsCreated}`)
    console.log('========================================\n')

  } catch (error) {
    console.error('Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillZeroInventory()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
