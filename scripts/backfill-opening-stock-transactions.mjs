/**
 * Backfill Script: Opening Stock StockTransaction Records
 *
 * Purpose: Create missing StockTransaction records for opening_stock entries
 *          that only exist in ProductHistory.
 *
 * This ensures StockTransaction is complete and can be used as a reliable
 * source for inventory ledger reports.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillOpeningStock() {
  console.log('='.repeat(80))
  console.log('BACKFILL: Opening Stock StockTransaction Records')
  console.log('='.repeat(80))
  console.log()

  try {
    // Step 1: Find all opening_stock records in ProductHistory
    console.log('Step 1: Finding opening_stock records in ProductHistory...')
    const openingStockHistory = await prisma.productHistory.findMany({
      where: {
        transactionType: 'opening_stock'
      },
      orderBy: {
        transactionDate: 'asc'
      }
    })

    console.log(`Found ${openingStockHistory.length} opening_stock records in ProductHistory`)

    if (openingStockHistory.length === 0) {
      console.log('✓ No opening stock records to backfill!')
      return
    }

    // Step 2: Check which ones are missing in StockTransaction
    console.log()
    console.log('Step 2: Checking for missing StockTransaction records...')

    const missing = []
    for (const history of openingStockHistory) {
      const exists = await prisma.stockTransaction.findFirst({
        where: {
          productVariationId: history.productVariationId,
          locationId: history.locationId,
          type: 'opening_stock'
        }
      })

      if (!exists) {
        missing.push(history)
      }
    }

    console.log(`Found ${missing.length} missing StockTransaction records`)

    if (missing.length === 0) {
      console.log('✓ All opening stock records already exist in StockTransaction!')
      return
    }

    // Step 3: Show what will be backfilled
    console.log()
    console.log('Step 3: Preview of records to be backfilled:')
    console.log('-'.repeat(80))
    missing.forEach((record, idx) => {
      console.log(`${idx + 1}. Product ${record.productId}, Variation ${record.productVariationId}, ` +
                  `Location ${record.locationId}, Qty: ${record.quantityChange}`)
    })

    // Step 4: Ask for confirmation
    console.log()
    console.log('⚠️  WARNING: This will insert StockTransaction records into the database.')
    console.log('⚠️  Make sure you have a backup before proceeding!')
    console.log()

    // For safety, we'll require manual confirmation
    // In production, you might want to add a CLI prompt
    const AUTO_CONFIRM = process.env.AUTO_CONFIRM === 'true'

    if (!AUTO_CONFIRM) {
      console.log('To proceed, run with: AUTO_CONFIRM=true node scripts/backfill-opening-stock-transactions.mjs')
      console.log('Exiting without making changes.')
      return
    }

    // Step 5: Backfill the records
    console.log()
    console.log('Step 5: Backfilling StockTransaction records...')
    console.log('-'.repeat(80))

    let successCount = 0
    let errorCount = 0

    for (const history of missing) {
      try {
        // Get current stock to calculate the balance at the time
        // For opening stock, the balance SHOULD equal the quantity
        const balanceQty = history.balanceQuantity || history.quantityChange

        await prisma.stockTransaction.create({
          data: {
            businessId: history.businessId,
            productId: history.productId,
            productVariationId: history.productVariationId,
            locationId: history.locationId,
            type: 'opening_stock',
            quantity: history.quantityChange,
            balanceQty: balanceQty,
            unitCost: history.unitCost || null,
            referenceType: history.referenceType || 'opening_stock',
            referenceId: history.referenceId,
            createdBy: history.createdBy,
            notes: history.reason || 'Backfilled from ProductHistory',
            createdAt: history.transactionDate
          }
        })

        successCount++
        console.log(`✓ Created: Product ${history.productId}, Variation ${history.productVariationId}, ` +
                    `Location ${history.locationId}`)
      } catch (error) {
        errorCount++
        console.error(`✗ Failed: Product ${history.productId}, Variation ${history.productVariationId}, ` +
                      `Location ${history.locationId}`)
        console.error(`  Error: ${error.message}`)
      }
    }

    // Step 6: Summary
    console.log()
    console.log('='.repeat(80))
    console.log('BACKFILL COMPLETE')
    console.log('='.repeat(80))
    console.log(`Successfully created: ${successCount} records`)
    console.log(`Failed: ${errorCount} records`)

    if (successCount > 0) {
      console.log()
      console.log('✓ StockTransaction table is now complete!')
      console.log('✓ Inventory ledger can now use StockTransaction as a reliable source.')
    }

  } catch (error) {
    console.error('Fatal error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillOpeningStock()
  .catch(error => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
