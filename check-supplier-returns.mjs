import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSupplierReturns() {
  try {
    console.log('🔍 Checking Supplier Returns vs Purchase Returns...\n')

    // Check PurchaseReturn table
    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: {
        businessId: 1,
      },
    })

    console.log('📦 PURCHASE RETURNS (returns TO suppliers):')
    console.log(`   Count: ${purchaseReturns.length}`)
    if (purchaseReturns.length > 0) {
      const total = purchaseReturns.reduce((sum, r) => sum + Number(r.totalAmount), 0)
      console.log(`   Total: ${total.toFixed(2)}`)
    } else {
      console.log('   Total: 0.00')
    }

    console.log('\n' + '='.repeat(60) + '\n')

    // Check SupplierReturn table
    const supplierReturns = await prisma.supplierReturn.findMany({
      where: {
        businessId: 1,
      },
    })

    console.log('📦 SUPPLIER RETURNS (returns FROM suppliers):')
    console.log(`   Count: ${supplierReturns.length}`)
    if (supplierReturns.length > 0) {
      const total = supplierReturns.reduce((sum, r) => sum + Number(r.totalAmount), 0)
      console.log(`   Total: ${total.toFixed(2)}`)

      console.log('\n   Sample records:')
      supplierReturns.slice(0, 5).forEach(r => {
        console.log(`   - ID: ${r.id}, Status: ${r.status}, Amount: ${Number(r.totalAmount).toFixed(2)}`)
      })
    } else {
      console.log('   Total: 0.00')
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n💡 EXPLANATION:')
    console.log('   Dashboard "Total Purchase Return" = SupplierReturn table (returns FROM suppliers)')
    console.log('   Purchase Returns page = PurchaseReturn table (returns TO suppliers)')
    console.log('\n   These are TWO DIFFERENT features!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSupplierReturns()
