/**
 * Fix Stock Discrepancies by Syncing Physical Stock to Ledger
 *
 * This script finds all inventory discrepancies and syncs physical stock
 * to match the ledger calculations.
 */

import { PrismaClient } from '@prisma/client'
import {
  findAllDiscrepancies,
  syncPhysicalToLedger,
  performIntegrityCheck,
} from '../src/lib/stockValidation'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Scanning for stock discrepancies...\n')

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
    })

    for (const business of businesses) {
      console.log(`\n📊 Checking business: ${business.name} (ID: ${business.id})`)
      console.log('='.repeat(60))

      // Run integrity check
      const report = await performIntegrityCheck(business.id)

      console.log(`Total variations: ${report.totalVariations}`)
      console.log(`Discrepancies found: ${report.discrepanciesFound}`)
      console.log(`Total variance: ${report.totalVariance}`)

      if (report.discrepanciesFound === 0) {
        console.log('✅ No discrepancies found!')
        continue
      }

      console.log('\n📝 Discrepancies:')
      console.log('-'.repeat(60))

      // Show top 10 discrepancies
      const topDiscrepancies = report.discrepancies.slice(0, 10)
      topDiscrepancies.forEach((d, index) => {
        console.log(`${index + 1}. ${d.productName} - ${d.variationName}`)
        console.log(`   Location: ${d.locationName}`)
        console.log(`   SKU: ${d.sku}`)
        console.log(`   Physical: ${d.physicalStock}, Ledger: ${d.ledgerCalculated}`)
        console.log(`   Variance: ${d.variance}`)
        console.log(`   Diagnosis: ${d.diagnosis}`)
        console.log('')
      })

      if (report.discrepancies.length > 10) {
        console.log(`... and ${report.discrepancies.length - 10} more`)
      }

      // Ask for confirmation to fix
      console.log('\n⚠️  Ready to sync physical stock to ledger calculations')
      console.log('This will overwrite physical stock values to match ledger.')
      console.log('\nProceeding with auto-fix...\n')

      // Fix all discrepancies
      let fixed = 0
      for (const discrepancy of report.discrepancies) {
        try {
          const result = await syncPhysicalToLedger(
            discrepancy.productVariationId,
            discrepancy.locationId
          )

          console.log(
            `✅ Fixed: ${discrepancy.productName} - ${discrepancy.variationName} at ${discrepancy.locationName}`
          )
          console.log(
            `   ${result.oldStock} → ${result.newStock} (${result.variance >= 0 ? '+' : ''}${result.variance})\n`
          )

          fixed++
        } catch (error: any) {
          console.error(
            `❌ Failed to fix ${discrepancy.productName}: ${error.message}`
          )
        }
      }

      console.log(`\n✅ Fixed ${fixed} out of ${report.discrepanciesFound} discrepancies`)

      // Re-run integrity check to verify
      console.log('\n🔍 Verifying fixes...')
      const verifyReport = await performIntegrityCheck(business.id)

      if (verifyReport.discrepanciesFound === 0) {
        console.log('✅ All discrepancies resolved!')
      } else {
        console.log(
          `⚠️  ${verifyReport.discrepanciesFound} discrepancies still remain. Manual review needed.`
        )
      }
    }

    console.log('\n✅ Stock discrepancy fix complete!')
    console.log('\n📝 You can now restart your dev server and test the POS system.')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
