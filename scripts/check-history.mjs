import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkHistory() {
  try {
    const count = await prisma.productHistory.count()
    console.log(`\n📊 Total Product History Records: ${count}\n`)

    if (count > 0) {
      // Count by transaction type
      const beginningCount = await prisma.productHistory.count({
        where: { transactionType: 'beginning_inventory' }
      })
      console.log(`✅ Beginning Inventory Records: ${beginningCount}`)

      // Get first record
      const first = await prisma.productHistory.findFirst({
        where: { transactionType: 'beginning_inventory' },
        orderBy: { id: 'asc' }
      })

      if (first) {
        console.log('\n📝 Sample Beginning Inventory Record:')
        console.log('─'.repeat(50))
        console.log(`Product ID: ${first.productId}`)
        console.log(`Transaction Type: ${first.transactionType}`)
        console.log(`Quantity Change: ${first.quantityChange}`)
        console.log(`Balance Quantity: ${first.balanceQuantity}`)
        console.log(`Unit Cost: ₱${Number(first.unitCost || 0).toFixed(2)}`)
        console.log(`Total Value: ₱${Number(first.totalValue || 0).toFixed(2)}`)
        console.log(`Reference: ${first.referenceNumber}`)
        console.log(`Created By: ${first.createdByName}`)
        console.log(`Date: ${first.transactionDate}`)
        console.log('─'.repeat(50))
      }

      // Check cost values in history
      const withCost = await prisma.productHistory.count({
        where: {
          transactionType: 'beginning_inventory',
          unitCost: { gt: 0 }
        }
      })
      const withoutCost = await prisma.productHistory.count({
        where: {
          transactionType: 'beginning_inventory',
          OR: [
            { unitCost: 0 },
            { unitCost: null }
          ]
        }
      })

      console.log(`\n💰 Cost Analysis:`)
      console.log(`  Records WITH cost (>0): ${withCost}`)
      console.log(`  Records WITHOUT cost (0 or null): ${withoutCost}`)

      // Sample records with cost
      const samples = await prisma.productHistory.findMany({
        where: {
          transactionType: 'beginning_inventory',
          unitCost: { gt: 0 }
        },
        take: 5,
        orderBy: { id: 'asc' }
      })

      if (samples.length > 0) {
        console.log('\n📋 Sample Records with Cost:')
        console.log('─'.repeat(80))
        samples.forEach((s, i) => {
          console.log(`${i+1}. Product ID ${s.productId} - Qty: ${s.quantityChange}, Unit Cost: ₱${Number(s.unitCost).toFixed(2)}, Total: ₱${Number(s.totalValue).toFixed(2)}`)
        })
        console.log('─'.repeat(80))
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkHistory()
