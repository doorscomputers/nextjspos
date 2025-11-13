/**
 * Check for Duplicate Invoice Numbers
 *
 * This script checks for duplicate invoice numbers in the sales table
 * and identifies which invoice number is causing the conflict.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicateInvoices() {
  try {
    console.log('🔍 Checking for duplicate invoice numbers...\n')

    // Find all invoice numbers with counts
    const duplicates = await prisma.$queryRaw<Array<{
      invoice_number: string
      count: bigint
      business_id: number
    }>>`
      SELECT invoice_number, business_id, COUNT(*) as count
      FROM sales
      GROUP BY invoice_number, business_id
      HAVING COUNT(*) > 1
    `

    if (duplicates.length === 0) {
      console.log('✅ No duplicate invoice numbers found.')
    } else {
      console.log(`❌ Found ${duplicates.length} duplicate invoice numbers:\n`)
      for (const dup of duplicates) {
        console.log(`   Invoice: ${dup.invoice_number}`)
        console.log(`   Business ID: ${dup.business_id}`)
        console.log(`   Count: ${dup.count}`)
        console.log('')
      }
    }

    // Check recent sales
    console.log('\n📊 Recent sales (last 10):')
    const recentSales = await prisma.sale.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      }
    })

    for (const sale of recentSales) {
      console.log(`   ${sale.invoiceNumber} - ₱${sale.totalAmount} - ${sale.status} - ${sale.createdAt.toLocaleString()}`)
    }

    // Check invoice sequences
    console.log('\n🔢 Invoice sequences:')
    const sequences = await prisma.invoiceSequence.findMany({
      orderBy: { id: 'desc' },
    })

    if (sequences.length === 0) {
      console.log('   ✅ No sequences found (good - they will regenerate)')
    } else {
      console.log(`   Found ${sequences.length} sequences:`)
      for (const seq of sequences) {
        console.log(`   Location ${seq.locationId}: ${seq.year}-${String(seq.month).padStart(2, '0')}-${String(seq.day).padStart(2, '0')} = ${seq.sequence}`)
      }
    }

  } catch (error) {
    console.error('❌ Error checking duplicates:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicateInvoices()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })
