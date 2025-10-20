import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testReports() {
  try {
    console.log('🧪 Testing Reports with Real Data\n')
    console.log('='  .repeat(70) + '\n')

    // Use the product we know has data: SKU 6908620061125
    const sku = '6908620061125'

    // Find product
    const product = await prisma.product.findFirst({
      where: { sku },
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    if (!product) {
      console.log('❌ Product not found')
      return
    }

    console.log(`✅ Testing Product: ${product.name} (ID: ${product.id})`)
    console.log(`   SKU: ${product.sku}\n`)

    // Get Main Store location
    const mainStore = await prisma.businessLocation.findFirst({
      where: { name: 'Main Store' }
    })

    if (!mainStore) {
      console.log('❌ Main Store location not found')
      return
    }

    console.log(`📍 Testing Location: ${mainStore.name} (ID: ${mainStore.id})\n`)

    const variation = product.variations[0]
    if (!variation) {
      console.log('❌ No variation found')
      return
    }

    console.log(`🔧 Testing Variation: ${variation.name} (ID: ${variation.id})\n`)

    // Get location detail
    const locationDetail = variation.variationLocationDetails.find(
      d => d.locationId === mainStore.id
    )

    if (locationDetail) {
      console.log(`📦 Current Stock in Database:`)
      console.log(`   Quantity Available: ${locationDetail.qtyAvailable}`)
      console.log(`   Selling Price: ₱${locationDetail.sellingPrice}\n`)
    }

    console.log('='  .repeat(70))
    console.log('TEST 1: ProductHistory Records')
    console.log('='  .repeat(70) + '\n')

    // Check ProductHistory
    const productHistory = await prisma.productHistory.findMany({
      where: {
        productId: product.id,
        productVariationId: variation.id,
        locationId: mainStore.id
      },
      orderBy: { transactionDate: 'asc' }
    })

    console.log(`📜 ProductHistory Records Found: ${productHistory.length}`)

    if (productHistory.length > 0) {
      console.log('\n   Details:')
      productHistory.forEach((h, i) => {
        console.log(`   ${i+1}. Type: ${h.transactionType}`)
        console.log(`      Qty Change: ${h.quantityChange}`)
        console.log(`      Balance: ${h.balanceQuantity}`)
        console.log(`      Date: ${h.transactionDate}`)
        console.log(`      Reference: ${h.referenceNumber}`)
        console.log(`      Reason: ${h.reason}`)
        console.log('')
      })
    } else {
      console.log('   ❌ No ProductHistory records found\n')
    }

    console.log('='  .repeat(70))
    console.log('TEST 2: StockTransaction Records')
    console.log('='  .repeat(70) + '\n')

    // Check StockTransactions
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        productId: product.id,
        productVariationId: variation.id,
        locationId: mainStore.id
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`📊 StockTransaction Records Found: ${stockTransactions.length}`)

    if (stockTransactions.length > 0) {
      console.log('\n   Details:')
      stockTransactions.slice(0, 5).forEach((t, i) => {
        console.log(`   ${i+1}. Type: ${t.type}`)
        console.log(`      Qty: ${t.quantity}`)
        console.log(`      Balance: ${t.balanceQty}`)
        console.log(`      Date: ${t.createdAt}`)
        console.log(`      Reference: ${t.referenceType}-${t.referenceId}`)
        console.log('')
      })
      if (stockTransactions.length > 5) {
        console.log(`   ... and ${stockTransactions.length - 5} more records\n`)
      }
    } else {
      console.log('   ℹ️  No StockTransaction records found (expected for newly imported products)\n')
    }

    console.log('='  .repeat(70))
    console.log('TEST 3: Combined History (What Reports Will Show)')
    console.log('='  .repeat(70) + '\n')

    // Simulate what the stock history library will return
    const allTransactions = [
      ...stockTransactions.map(t => ({ source: 'stockTransaction', data: t, date: t.createdAt })),
      ...productHistory.map(h => ({ source: 'productHistory', data: h, date: h.transactionDate }))
    ].sort((a, b) => a.date.getTime() - b.date.getTime())

    console.log(`📋 Total Combined Transactions: ${allTransactions.length}\n`)

    if (allTransactions.length > 0) {
      console.log('   Timeline:')
      let runningBalance = 0

      allTransactions.forEach((item, i) => {
        if (item.source === 'stockTransaction') {
          const t = item.data
          runningBalance = parseFloat(t.balanceQty.toString())
          console.log(`   ${i+1}. [StockTransaction] ${t.type}`)
          console.log(`      Qty: ${t.quantity}, Balance: ${runningBalance}`)
        } else {
          const h = item.data
          const qtyChange = parseFloat(h.quantityChange.toString())
          runningBalance += qtyChange
          console.log(`   ${i+1}. [ProductHistory] ${h.transactionType}`)
          console.log(`      Qty Change: ${qtyChange}, Balance: ${runningBalance}`)
        }
        console.log(`      Date: ${item.date}`)
        console.log('')
      })

      console.log(`   📊 Final Balance: ${runningBalance}`)
      console.log(`   ✅ Match with DB: ${runningBalance === parseFloat(locationDetail.qtyAvailable.toString()) ? 'YES' : 'NO'}\n`)
    } else {
      console.log('   ❌ No transactions found at all\n')
    }

    console.log('='  .repeat(70))
    console.log('TEST SUMMARY')
    console.log('='  .repeat(70) + '\n')

    const hasProductHistory = productHistory.length > 0
    const hasOpeningStock = productHistory.some(h => h.transactionType === 'opening_stock')
    const totalTransactions = allTransactions.length

    console.log(`✅ ProductHistory records exist: ${hasProductHistory ? 'YES' : 'NO'}`)
    console.log(`✅ Opening stock records found: ${hasOpeningStock ? 'YES' : 'NO'}`)
    console.log(`✅ Total transactions to show: ${totalTransactions}`)
    console.log(`✅ Reports will show data: ${totalTransactions > 0 ? 'YES' : 'NO'}`)

    if (totalTransactions > 0 && hasOpeningStock) {
      console.log('\n🎉 SUCCESS! Both reports should now display beginning inventory!\n')
    } else {
      console.log('\n⚠️  WARNING: Reports may still show empty data\n')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testReports()
