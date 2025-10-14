const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPurchaseAnalyticsData() {
  try {
    console.log('Checking Purchase Analytics Data...\n')

    // Check all purchases in the system
    console.log('=== ALL PURCHASES ===')
    const allPurchases = await prisma.purchase.findMany({
      where: {
        businessId: 1,
        deletedAt: null
      },
      select: {
        id: true,
        purchaseOrderNumber: true,
        status: true,
        purchaseDate: true,
        totalAmount: true,
        supplierId: true,
        supplier: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    })

    console.log(`Total purchases found: ${allPurchases.length}\n`)
    allPurchases.forEach(p => {
      console.log(`${p.purchaseOrderNumber}:`)
      console.log(`  Status: ${p.status}`)
      console.log(`  Date: ${p.purchaseDate}`)
      console.log(`  Supplier: ${p.supplier.name}`)
      console.log(`  Amount: ${p.totalAmount}`)
      console.log()
    })

    // Check purchases in the date range (09/12/2025 - 10/12/2025)
    console.log('=== PURCHASES IN DATE RANGE (09/12/2025 - 10/12/2025) ===')
    const startDate = new Date('2025-09-12T00:00:00')
    const endDate = new Date('2025-10-12T23:59:59.999')

    const purchasesInRange = await prisma.purchase.findMany({
      where: {
        businessId: 1,
        deletedAt: null,
        purchaseDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        purchaseOrderNumber: true,
        status: true,
        purchaseDate: true,
        totalAmount: true
      }
    })

    console.log(`Purchases in date range: ${purchasesInRange.length}\n`)
    purchasesInRange.forEach(p => {
      console.log(`${p.purchaseOrderNumber}: ${p.status} (${p.purchaseDate})`)
    })
    console.log()

    // Check purchases with 'received' or 'completed' status
    console.log('=== PURCHASES WITH RECEIVED/COMPLETED STATUS ===')
    const completedPurchases = await prisma.purchase.findMany({
      where: {
        businessId: 1,
        deletedAt: null,
        status: {
          in: ['received', 'completed']
        }
      },
      select: {
        id: true,
        purchaseOrderNumber: true,
        status: true,
        purchaseDate: true
      }
    })

    console.log(`Purchases with received/completed status: ${completedPurchases.length}\n`)
    completedPurchases.forEach(p => {
      console.log(`${p.purchaseOrderNumber}: ${p.status} (${p.purchaseDate})`)
    })
    console.log()

    // Check purchase returns
    console.log('=== PURCHASE RETURNS ===')
    const returns = await prisma.purchaseReturn.findMany({
      where: {
        businessId: 1,
        deletedAt: null
      },
      select: {
        id: true,
        returnDate: true,
        reason: true,
        purchase: {
          select: {
            purchaseOrderNumber: true
          }
        }
      }
    })

    console.log(`Total purchase returns: ${returns.length}\n`)
    if (returns.length > 0) {
      returns.forEach(r => {
        console.log(`Return for ${r.purchase.purchaseOrderNumber}:`)
        console.log(`  Date: ${r.returnDate}`)
        console.log(`  Reason: ${r.reason || 'not specified'}`)
        console.log()
      })
    } else {
      console.log('No purchase returns found.\n')
    }

    // Check suppliers
    console.log('=== SUPPLIERS ===')
    const suppliers = await prisma.supplier.findMany({
      where: {
        businessId: 1,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            purchases: true
          }
        }
      }
    })

    console.log(`Total suppliers: ${suppliers.length}\n`)
    suppliers.forEach(s => {
      console.log(`${s.name}: ${s._count.purchases} purchases`)
    })
    console.log()

    // Summary for Purchase Analytics requirements
    console.log('=== SUMMARY FOR PURCHASE ANALYTICS ===')
    console.log(`1. Return Analysis requires:`)
    console.log(`   - Purchase returns in date range`)
    console.log(`   - Current: ${returns.length} returns total`)
    console.log()
    console.log(`2. Supplier Performance requires:`)
    console.log(`   - Purchases with 'received' or 'completed' status in date range`)
    console.log(`   - Current: ${completedPurchases.length} completed purchases total`)
    console.log(`   - In date range: Need to check with both filters`)
    console.log()
    console.log(`3. Purchase Variance requires:`)
    console.log(`   - Purchases with 'received' or 'completed' status in date range`)
    console.log(`   - Items with quantityReceived data`)
    console.log()

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPurchaseAnalyticsData()
