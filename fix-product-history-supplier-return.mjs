import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Fix ProductHistory records for existing supplier returns
 * Update referenceNumber and reason to show proper SR number and supplier name
 */

async function fixProductHistoryRecords() {
  console.log('================================================================================')
  console.log('FIX PRODUCT HISTORY FOR SUPPLIER RETURNS')
  console.log('================================================================================')
  console.log()

  try {
    // Find all supplier return records
    const supplierReturns = await prisma.supplierReturn.findMany({
      include: {
        supplier: true,
        items: true,
      },
    })

    console.log(`Found ${supplierReturns.length} supplier return(s)`)
    console.log()

    if (supplierReturns.length === 0) {
      console.log('✓ No supplier returns to fix')
      return
    }

    let totalFixed = 0

    for (const sr of supplierReturns) {
      console.log(`Processing: ${sr.returnNumber} - ${sr.supplier.name}`)

      // Find ProductHistory records for this supplier return
      const historyRecords = await prisma.productHistory.findMany({
        where: {
          referenceType: 'supplier_return',
          referenceId: sr.id,
          businessId: sr.businessId,
        },
      })

      console.log(`  Found ${historyRecords.length} history record(s)`)

      for (const history of historyRecords) {
        const currentRef = history.referenceNumber
        const currentReason = history.reason

        // Build proper reason with supplier and return reason
        const newReason = `Supplier Return ${sr.returnNumber} to ${sr.supplier.name}${
          sr.returnReason ? ` (${sr.returnReason})` : ''
        }`

        // Update the record
        await prisma.productHistory.update({
          where: { id: history.id },
          data: {
            referenceNumber: sr.returnNumber,
            reason: newReason,
          },
        })

        console.log(`  ✓ Updated ProductHistory #${history.id}`)
        console.log(`    Old Reference: "${currentRef}" → New: "${sr.returnNumber}"`)
        console.log(`    Old Reason: "${currentReason}" → New: "${newReason}"`)

        totalFixed++
      }

      console.log()
    }

    console.log('================================================================================')
    console.log('SUCCESS')
    console.log('================================================================================')
    console.log(`Total ProductHistory records fixed: ${totalFixed}`)
    console.log()
    console.log('✓ All supplier return history records now show proper reference numbers')
    console.log('✓ You can now trace transactions properly in stock history pages')

  } catch (error) {
    console.error('❌ Error fixing product history:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixProductHistoryRecords()
  .catch(console.error)
