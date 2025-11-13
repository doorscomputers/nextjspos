/**
 * Clear Invoice Sequences Table
 *
 * This script clears the invoice_sequences table to resolve conflicts after
 * adding the 'day' column. Existing sequences have day=1 (default), causing
 * unique constraint violations when generating new invoice numbers for other days.
 *
 * Safe to run: Invoice sequences are regenerated automatically on next sale.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearInvoiceSequences() {
  try {
    console.log('🔧 Clearing invoice_sequences table to resolve day column conflicts...\n')

    // Count existing records
    const count = await prisma.invoiceSequence.count()
    console.log(`📊 Found ${count} existing sequence records\n`)

    if (count === 0) {
      console.log('✅ No sequences to clear. Table is already empty.')
      return
    }

    // Delete all records
    const result = await prisma.invoiceSequence.deleteMany({})
    console.log(`✅ Deleted ${result.count} sequence records\n`)

    console.log('🎯 Invoice sequences will regenerate automatically on next sale.')
    console.log('   Format: Inv{Location}{MM_DD_YYYY}_####\n')
  } catch (error) {
    console.error('❌ Error clearing sequences:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearInvoiceSequences()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
