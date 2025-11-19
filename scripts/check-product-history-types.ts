/**
 * Check what transaction types exist in ProductHistory
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTransactionTypes() {
  console.log('🔍 Checking ProductHistory transaction types...\n')

  try {
    const records = await prisma.productHistory.findMany({
      select: {
        transactionType: true,
        referenceType: true,
        referenceNumber: true,
        createdByName: true,
      },
      take: 50
    })

    console.log(`📦 Found ${records.length} records\n`)

    const typeGroups: Record<string, number> = {}

    for (const record of records) {
      const key = `${record.transactionType} (ref: ${record.referenceType})`
      typeGroups[key] = (typeGroups[key] || 0) + 1
    }

    console.log('Transaction Types:')
    console.log('==================')
    for (const [type, count] of Object.entries(typeGroups)) {
      console.log(`${type}: ${count} records`)
    }

    console.log('\n\nSample Records:')
    console.log('================')
    for (const record of records.slice(0, 10)) {
      console.log(`Type: ${record.transactionType} | Ref: ${record.referenceType} | ${record.referenceNumber} | Created By: ${record.createdByName}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTransactionTypes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
