const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * PROPER Inventory Correction Script
 *
 * This script uses productHistory as the SOURCE OF TRUTH
 * and rebuilds stockTransaction and qtyAvailable to match it.
 *
 * Previous script was flawed because it used current qtyAvailable,
 * which could already be wrong due to missing stockTransaction records.
 */

async function fixInventoryUsingProductHistory() {
  console.log('='.repeat(80))
  console.log('PROPER INVENTORY CORRECTION - Using Product History as Source of Truth')
  console.log('='.repeat(80))
  console.log('')

  const dryRun = !process.argv.includes('--execute')

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('   Add --execute flag to apply changes')
    console.log('')
  } else {
    console.log('⚠️  EXECUTE MODE - Changes will be applied!')
    console.log('')
  }

  try {
    // Step 1: Get all products with variations
    const products = await prisma.product.findMany({
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    console.log(`Found ${products.length} products to analyze\n`)

    let totalDiscrepancies = 0
    let totalFixed = 0
    const corrections = []

    // Step 2: For each product variation and location
    for (const product of products) {
      for (const variation of product.variations) {
        // Get all product history for this variation
        const history = await prisma.productHistory.findMany({
          where: {
            productVariationId: variation.id
          },
          orderBy: {
            transactionDate: 'asc'
          }
        })

        if (history.length === 0) continue

        // Group by location
        const locationGroups = {}
        for (const record of history) {
          if (!locationGroups[record.locationId]) {
            locationGroups[record.locationId] = []
          }
          locationGroups[record.locationId].push(record)
        }

        // For each location, calculate expected inventory from history
        for (const [locationId, records] of Object.entries(locationGroups)) {
          const locId = parseInt(locationId)

          // Calculate expected from productHistory (SOURCE OF TRUTH)
          const expectedQty = records.reduce((sum, rec) => {
            return sum + parseFloat(rec.quantityChange)
          }, 0)

          // Get actual qtyAvailable
          const actualRecord = variation.variationLocationDetails.find(
            vld => vld.locationId === locId
          )
          const actualQty = actualRecord ? parseFloat(actualRecord.qtyAvailable) : 0

          // Check for discrepancy
          if (Math.abs(expectedQty - actualQty) > 0.01) {
            totalDiscrepancies++

            const correction = {
              productId: product.id,
              productName: product.name,
              productSku: product.sku,
              variationId: variation.id,
              variationName: variation.name,
              locationId: locId,
              expectedQty,
              actualQty,
              difference: expectedQty - actualQty
            }

            corrections.push(correction)

            console.log(`❌ DISCREPANCY FOUND:`)
            console.log(`   Product: ${product.name} (${product.sku})`)
            console.log(`   Variation: ${variation.name}`)
            console.log(`   Location ID: ${locId}`)
            console.log(`   Expected (from productHistory): ${expectedQty}`)
            console.log(`   Actual (qtyAvailable): ${actualQty}`)
            console.log(`   Difference: ${correction.difference > 0 ? '+' : ''}${correction.difference}`)
            console.log('')
          }
        }
      }
    }

    console.log('='.repeat(80))
    console.log(`SUMMARY:`)
    console.log(`   Total Discrepancies Found: ${totalDiscrepancies}`)
    console.log('='.repeat(80))
    console.log('')

    if (corrections.length === 0) {
      console.log('✅ No discrepancies found! All inventory matches productHistory.')
      return
    }

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes made')
      console.log('   Run with --execute to apply corrections')
      console.log('')
      console.log('Corrections that WOULD be applied:')
      console.log('')

      for (const correction of corrections) {
        console.log(`   ${correction.productName} @ Location ${correction.locationId}:`)
        console.log(`      Current: ${correction.actualQty} → New: ${correction.expectedQty}`)
      }

      return
    }

    // EXECUTE MODE - Apply corrections
    console.log('⚠️  APPLYING CORRECTIONS...')
    console.log('')

    for (const correction of corrections) {
      try {
        // Update qtyAvailable to match productHistory
        const updated = await prisma.variationLocationDetails.updateMany({
          where: {
            productVariationId: correction.variationId,
            locationId: correction.locationId
          },
          data: {
            qtyAvailable: correction.expectedQty
          }
        })

        if (updated.count > 0) {
          totalFixed++
          console.log(`✅ FIXED: ${correction.productName} @ Location ${correction.locationId}`)
          console.log(`   Updated qtyAvailable: ${correction.actualQty} → ${correction.expectedQty}`)
        } else {
          console.log(`⚠️  WARNING: Could not update ${correction.productName} @ Location ${correction.locationId}`)
        }

      } catch (error) {
        console.error(`❌ ERROR fixing ${correction.productName}:`, error.message)
      }
    }

    console.log('')
    console.log('='.repeat(80))
    console.log(`EXECUTION SUMMARY:`)
    console.log(`   Total Discrepancies: ${totalDiscrepancies}`)
    console.log(`   Successfully Fixed: ${totalFixed}`)
    console.log(`   Failed: ${totalDiscrepancies - totalFixed}`)
    console.log('='.repeat(80))

    // Now rebuild stockTransaction to match productHistory
    console.log('')
    console.log('='.repeat(80))
    console.log('REBUILDING STOCK TRANSACTIONS')
    console.log('='.repeat(80))
    console.log('')

    // Delete all existing stockTransaction records
    const deletedCount = await prisma.stockTransaction.deleteMany({})
    console.log(`🗑️  Deleted ${deletedCount.count} existing stockTransaction records`)
    console.log('')

    // Rebuild from productHistory
    let createdCount = 0
    for (const product of products) {
      for (const variation of product.variations) {
        const history = await prisma.productHistory.findMany({
          where: {
            productVariationId: variation.id
          },
          orderBy: {
            transactionDate: 'asc'
          }
        })

        for (const record of history) {
          try {
            await prisma.stockTransaction.create({
              data: {
                businessId: record.businessId,
                locationId: record.locationId,
                productId: record.productId,
                productVariationId: record.productVariationId,
                type: record.transactionType,
                quantity: parseFloat(record.quantityChange),
                balanceQty: parseFloat(record.balanceQuantity),
                unitCost: parseFloat(record.unitCost),
                referenceType: record.referenceType,
                referenceId: record.referenceId,
                notes: `Rebuilt from productHistory`,
                createdBy: record.createdBy,
                createdAt: record.transactionDate
              }
            })
            createdCount++
          } catch (error) {
            console.error(`❌ Error creating stockTransaction for ${product.name}:`, error.message)
          }
        }
      }
    }

    console.log(`✅ Created ${createdCount} new stockTransaction records`)
    console.log('')
    console.log('='.repeat(80))
    console.log('CORRECTION COMPLETE!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixInventoryUsingProductHistory()
