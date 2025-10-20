import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicateTransactions() {
  console.log('=== Checking for Duplicate Stock Transactions ===\n')

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true }
    })

    for (const business of businesses) {
      console.log(`\nBusiness: ${business.name} (ID: ${business.id})`)
      console.log('='.repeat(80))

      // Get all stock transactions for this business
      const stockTransactions = await prisma.stockTransaction.findMany({
        where: {
          businessId: business.id,
          type: 'purchase'
        },
        orderBy: { createdAt: 'asc' },
        include: {
          product: {
            select: { name: true }
          },
          productVariation: {
            select: { name: true }
          }
        }
      })

      // Get all product history records for this business
      const productHistory = await prisma.productHistory.findMany({
        where: {
          businessId: business.id,
          transactionType: 'purchase'
        },
        orderBy: { transactionDate: 'asc' }
      })

      console.log(`Stock Transactions (purchase type): ${stockTransactions.length}`)
      console.log(`Product History (purchase type): ${productHistory.length}`)

      // Group by product variation and location to find potential duplicates
      const duplicateGroups = new Map()

      // Add stock transactions to groups
      for (const st of stockTransactions) {
        const key = `${st.productVariationId}-${st.locationId}-${st.referenceId}-${st.quantity}`
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, { stockTransactions: [], productHistory: [] })
        }
        duplicateGroups.get(key).stockTransactions.push(st)
      }

      // Add product history to groups
      for (const ph of productHistory) {
        const key = `${ph.productVariationId}-${ph.locationId}-${ph.referenceId}-${ph.quantityChange}`
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, { stockTransactions: [], productHistory: [] })
        }
        duplicateGroups.get(key).productHistory.push(ph)
      }

      // Find groups that have both
      let duplicateCount = 0
      for (const [key, group] of duplicateGroups) {
        if (group.stockTransactions.length > 0 && group.productHistory.length > 0) {
          duplicateCount++
          const st = group.stockTransactions[0]
          const ph = group.productHistory[0]

          console.log(`\n${duplicateCount}. Duplicate Found:`)
          console.log(`   Product: ${st.product.name} - ${st.productVariation.name}`)
          console.log(`   Quantity: ${st.quantity}`)
          console.log(`   Reference ID: ${st.referenceId}`)
          console.log(`   Location ID: ${st.locationId}`)
          console.log(`   Stock Transaction ID: ${st.id} (Created: ${st.createdAt})`)
          console.log(`   Product History ID: ${ph.id} (Created: ${ph.transactionDate})`)
          console.log(`   Stock Transaction Type: ${st.type}`)
          console.log(`   Product History Type: ${ph.transactionType}`)
          console.log(`   Stock Transaction Notes: ${st.notes}`)
          console.log(`   Product History Reason: ${ph.reason}`)
        }
      }

      if (duplicateCount === 0) {
        console.log('\n✅ No duplicates found for this business')
      } else {
        console.log(`\n⚠️  Found ${duplicateCount} potential duplicates`)
      }
    }

  } catch (error) {
    console.error('Error checking duplicates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicateTransactions()
