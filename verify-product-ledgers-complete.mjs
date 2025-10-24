import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyProductLedgers() {
  console.log('\n' + '='.repeat(100))
  console.log('COMPREHENSIVE PRODUCT LEDGER & HISTORY VERIFICATION')
  console.log('='.repeat(100) + '\n')

  try {
    // Get both products
    const drawer = await prisma.product.findFirst({
      where: { name: { contains: '2 DOOR DRAWER' } },
      include: { variations: true }
    })

    const ssd = await prisma.product.findFirst({
      where: { name: { contains: 'ADATA 512GB 2.5 SSD' } },
      include: { variations: true }
    })

    if (!drawer || !ssd) {
      console.log('❌ Products not found!')
      return
    }

    // Get all locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: 1 },
      orderBy: { id: 'asc' }
    })

    console.log(`✅ Products Found:`)
    console.log(`   1. ${drawer.name} (ID: ${drawer.id}, Variation: ${drawer.variations[0].id})`)
    console.log(`   2. ${ssd.name} (ID: ${ssd.id}, Variation: ${ssd.variations[0].id})`)
    console.log()
    console.log(`✅ Locations Found: ${locations.map(l => l.name).join(', ')}`)
    console.log('\n' + '='.repeat(100))

    // Verify each product at each location
    for (const product of [drawer, ssd]) {
      await verifyProduct(product, locations)
    }

    // Overall Summary
    console.log('\n' + '='.repeat(100))
    console.log('OVERALL VERIFICATION SUMMARY')
    console.log('='.repeat(100))
    console.log()

    // Check supplier return accounting
    console.log('📊 ACCOUNTS PAYABLE VERIFICATION:')
    console.log('-'.repeat(100))

    const grandTechSupplier = await prisma.supplier.findFirst({
      where: { name: 'GRAND TECH' }
    })

    if (grandTechSupplier) {
      const apEntries = await prisma.accountsPayable.findMany({
        where: { supplierId: grandTechSupplier.id },
        orderBy: { invoiceDate: 'asc' }
      })

      let totalOwed = 0
      for (const ap of apEntries) {
        const balance = Number(ap.balanceAmount)
        totalOwed += balance
        console.log(`   Invoice: ${ap.invoiceNumber}`)
        console.log(`     Total: ₱${Number(ap.totalAmount).toFixed(2)}`)
        console.log(`     Paid: ₱${Number(ap.paidAmount).toFixed(2)}`)
        console.log(`     Balance: ₱${balance.toFixed(2)} (${ap.paymentStatus})`)
        console.log()
      }

      console.log(`   ═══════════════════════════════════════`)
      console.log(`   TOTAL OWED TO GRAND TECH: ₱${totalOwed.toFixed(2)}`)
      console.log()

      // Check supplier return payments
      const supplierReturnPayments = await prisma.payment.findMany({
        where: {
          supplierId: grandTechSupplier.id,
          paymentMethod: 'supplier_return_credit'
        }
      })

      console.log(`   Supplier Return Credits Applied: ${supplierReturnPayments.length}`)
      for (const payment of supplierReturnPayments) {
        console.log(`     ${payment.paymentNumber}: ₱${Number(payment.amount).toFixed(2)} (${payment.transactionReference})`)
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('✅ VERIFICATION COMPLETE')
    console.log('='.repeat(100) + '\n')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function verifyProduct(product, locations) {
  console.log('\n' + '█'.repeat(100))
  console.log(`PRODUCT: ${product.name}`)
  console.log('█'.repeat(100) + '\n')

  const variationId = product.variations[0].id

  for (const location of locations) {
    console.log(`\n${'▼'.repeat(50)}`)
    console.log(`LOCATION: ${location.name}`)
    console.log('▼'.repeat(50))

    // Get current stock
    const stockDetails = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variationId,
          locationId: location.id
        }
      }
    })

    const currentStock = stockDetails ? Number(stockDetails.qtyAvailable) : 0
    console.log(`\n📦 Current Stock: ${currentStock.toFixed(2)} units`)
    console.log()

    // Get ProductHistory
    const history = await prisma.productHistory.findMany({
      where: {
        productId: product.id,
        productVariationId: variationId,
        locationId: location.id
      },
      orderBy: { transactionDate: 'asc' }
    })

    console.log(`📜 TRANSACTION HISTORY (${history.length} transactions):`)
    console.log('-'.repeat(100))
    console.log(` #  Date         Type              Ref Number          Qty Change  Balance    Reason`)
    console.log('-'.repeat(100))

    let calculatedBalance = 0
    history.forEach((h, index) => {
      const qtyChange = Number(h.quantityChange)
      calculatedBalance += qtyChange
      const balance = Number(h.balanceQuantity)

      const qtyStr = qtyChange >= 0 ? `+${qtyChange.toFixed(2)}` : `${qtyChange.toFixed(2)}`
      const balanceStr = balance.toFixed(2)

      console.log(
        ` ${String(index + 1).padStart(2)} ` +
        `${h.transactionDate.toISOString().slice(0, 10)} ` +
        `${h.transactionType.padEnd(17)} ` +
        `${(h.referenceNumber || 'N/A').padEnd(19)} ` +
        `${qtyStr.padStart(10)} ` +
        `${balanceStr.padStart(10)} ` +
        `${h.reason || ''}`
      )
    })

    console.log('-'.repeat(100))
    console.log(`Ledger Balance (sum of qty changes): ${calculatedBalance.toFixed(2)}`)
    console.log(`Current Stock (variation_location_details): ${currentStock.toFixed(2)}`)

    const discrepancy = currentStock - calculatedBalance
    if (Math.abs(discrepancy) < 0.01) {
      console.log(`✅ PERFECT MATCH! Ledger and current stock are aligned.`)
    } else {
      console.log(`⚠️  DISCREPANCY: ${discrepancy.toFixed(2)} units difference!`)
    }

    // Get StockTransactions
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: variationId,
        locationId: location.id
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log()
    console.log(`📊 STOCK TRANSACTIONS (${stockTransactions.length} records):`)
    console.log('-'.repeat(100))

    let stBalance = 0
    stockTransactions.forEach((st, index) => {
      const qty = Number(st.quantity)
      stBalance += qty
      const balanceAfter = Number(st.balanceQty)

      console.log(
        ` ${String(index + 1).padStart(2)} ` +
        `${st.type.padEnd(17)} ` +
        `Qty: ${qty >= 0 ? '+' : ''}${qty.toFixed(2).padStart(8)} ` +
        `Balance: ${balanceAfter.toFixed(2).padStart(8)} ` +
        `(${st.notes || 'No notes'})`
      )
    })

    console.log('-'.repeat(100))
    console.log(`Stock Transaction Balance: ${stBalance.toFixed(2)}`)
    console.log()

    // Serial numbers for drawer
    if (product.name.includes('DRAWER')) {
      const serials = await prisma.productSerialNumber.findMany({
        where: {
          productId: product.id,
          productVariationId: variationId,
          currentLocationId: location.id
        }
      })

      console.log(`📟 SERIAL NUMBERS AT THIS LOCATION: ${serials.length}`)
      if (serials.length > 0) {
        serials.forEach(s => {
          console.log(`   ${s.serialNumber}: ${s.status}`)
        })
      }
      console.log()
    }

    // Supplier returns
    const supplierReturns = await prisma.supplierReturn.findMany({
      where: {
        locationId: location.id
      },
      include: {
        items: {
          where: {
            productId: product.id,
            productVariationId: variationId
          }
        },
        supplier: true
      }
    })

    if (supplierReturns.length > 0) {
      console.log(`🔄 SUPPLIER RETURNS FROM THIS LOCATION: ${supplierReturns.length}`)
      for (const sr of supplierReturns) {
        if (sr.items.length > 0) {
          console.log(`   ${sr.returnNumber} to ${sr.supplier.name}:`)
          console.log(`     Status: ${sr.status}`)
          console.log(`     Approved: ${sr.approvedAt ? '✅ YES' : '❌ NO'}`)
          console.log(`     ApprovedAt: ${sr.approvedAt || 'Not set'}`)
          sr.items.forEach(item => {
            console.log(`     Qty: ${item.quantity}, Unit Cost: ₱${item.unitCost}`)
          })
        }
      }
      console.log()
    }
  }
}

// Run verification
verifyProductLedgers()
  .catch(console.error)
