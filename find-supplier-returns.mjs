import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findSupplierReturns() {
  try {
    console.log('Searching for all Supplier Returns...\n')

    const returns = await prisma.supplierReturn.findMany({
      include: {
        supplier: true,
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`Found ${returns.length} supplier return(s)\n`)

    if (returns.length === 0) {
      console.log('No supplier returns found in the database.')

      // Check if table exists and has the right structure
      console.log('\nChecking if supplier_returns table exists...')
      const tableCheck = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_name = 'supplier_returns'
      `
      console.log('Table check result:', tableCheck)
    } else {
      for (const ret of returns) {
        console.log('=' .repeat(80))
        console.log(`Return Number: ${ret.returnNumber}`)
        console.log(`Date: ${ret.returnDate.toISOString().split('T')[0]}`)
        console.log(`Supplier: ${ret.supplier.name} (ID: ${ret.supplierId})`)
        console.log(`Status: ${ret.status}`)
        console.log(`Reason: ${ret.returnReason}`)
        console.log(`Total Amount: ₱${Number(ret.totalAmount).toFixed(2)}`)
        console.log(`Items Count: ${ret.items.length}`)
        console.log()
      }
    }

    // Also check for ADATA product
    console.log('\nSearching for ADATA 512GB 2.5 SSD product...')
    const adataProduct = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'ADATA'
        }
      }
    })

    if (adataProduct) {
      console.log(`✅ Found: ${adataProduct.name} (ID: ${adataProduct.id})`)

      // Check ProductHistory for this product
      console.log('\nChecking ProductHistory for supplier_return transactions...')
      const history = await prisma.productHistory.findMany({
        where: {
          productId: adataProduct.id,
          transactionType: 'supplier_return'
        },
        orderBy: {
          transactionDate: 'desc'
        }
      })

      console.log(`Found ${history.length} supplier_return history record(s)`)

      for (const h of history) {
        console.log(`  - Date: ${h.transactionDate.toISOString()}`)
        console.log(`    Qty Change: ${Number(h.quantityChange)}`)
        console.log(`    Reference: ${h.referenceType} #${h.referenceId}`)
        console.log(`    Reason: ${h.reason || 'N/A'}`)
        console.log()
      }
    } else {
      console.log('❌ ADATA product not found')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

findSupplierReturns()
