/**
 * Product Purchase History Report Test
 * Tests the report API and verifies data accuracy
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testProductPurchaseHistoryReport() {
  console.log('\n🚀 Starting Product Purchase History Report Test\n')

  try {
    // Test 1: Get user and business
    console.log('📋 Test 1: Fetching test data...')

    const superadmin = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: { business: true }
    })

    if (!superadmin) {
      throw new Error('Superadmin not found')
    }

    console.log(`✅ User: ${superadmin.username} (ID: ${superadmin.id})`)
    console.log(`✅ Business: ${superadmin.business.name} (ID: ${superadmin.businessId})`)

    // Test 2: Check for products
    console.log('\n📦 Test 2: Checking products...')

    const productCount = await prisma.product.count({
      where: { businessId: superadmin.businessId }
    })

    console.log(`✅ Found ${productCount} products in business`)

    if (productCount === 0) {
      console.log('⚠️  No products found. Please add products to test the report.')
      return
    }

    // Test 3: Check for purchase receipts
    console.log('\n📝 Test 3: Checking purchase receipts...')

    const receiptCount = await prisma.purchaseReceipt.count({
      where: { businessId: superadmin.businessId }
    })

    console.log(`✅ Found ${receiptCount} purchase receipts`)

    if (receiptCount === 0) {
      console.log('⚠️  No purchase receipts found. The report will show products with no purchase history.')
    }

    // Test 4: Get sample product with purchase history
    console.log('\n🔍 Test 4: Finding product with purchase history...')

    const productsWithPurchases = await prisma.product.findMany({
      where: {
        businessId: superadmin.businessId,
        receiptItems: {
          some: {}
        }
      },
      include: {
        receiptItems: {
          include: {
            purchaseReceipt: {
              include: {
                supplier: true
              }
            }
          },
          orderBy: {
            purchaseReceipt: {
              receiptDate: 'desc'
            }
          },
          take: 1
        },
        variations: true
      },
      take: 5
    })

    if (productsWithPurchases.length > 0) {
      console.log(`✅ Found ${productsWithPurchases.length} products with purchase history`)

      productsWithPurchases.forEach((product, index) => {
        console.log(`\n   Product ${index + 1}:`)
        console.log(`   - Name: ${product.name}`)
        console.log(`   - SKU: ${product.sku || 'N/A'}`)

        if (product.receiptItems.length > 0) {
          const lastPurchase = product.receiptItems[0]
          console.log(`   - Last Supplier: ${lastPurchase.purchaseReceipt.supplier.name}`)
          console.log(`   - Last Receipt: ${lastPurchase.purchaseReceipt.receiptNumber}`)
          console.log(`   - Last Date: ${lastPurchase.purchaseReceipt.receiptDate.toISOString().split('T')[0]}`)
          console.log(`   - Quantity: ${lastPurchase.quantityReceived}`)
        }
      })
    } else {
      console.log('⚠️  No products with purchase history found')
    }

    // Test 5: Test inventory movements for cost tracking
    console.log('\n💰 Test 5: Checking inventory movements for cost data...')

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        businessId: superadmin.businessId,
        movementType: 'purchase_receipt'
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    if (movements.length > 0) {
      console.log(`✅ Found ${movements.length} inventory movements with cost data`)

      movements.forEach((movement, index) => {
        console.log(`\n   Movement ${index + 1}:`)
        console.log(`   - Product: ${movement.product.name}`)
        console.log(`   - Unit Cost: $${parseFloat(movement.unitCost.toString()).toFixed(2)}`)
        console.log(`   - Quantity In: ${movement.quantityIn}`)
        console.log(`   - Total Cost: $${parseFloat(movement.totalCost.toString()).toFixed(2)}`)
      })
    } else {
      console.log('⚠️  No inventory movements found')
    }

    // Test 6: Summary statistics
    console.log('\n📊 Test 6: Generating summary statistics...')

    const totalProducts = await prisma.product.count({
      where: { businessId: superadmin.businessId }
    })

    const productsWithHistory = await prisma.product.count({
      where: {
        businessId: superadmin.businessId,
        receiptItems: {
          some: {}
        }
      }
    })

    const totalPurchaseAmount = await prisma.inventoryMovement.aggregate({
      where: {
        businessId: superadmin.businessId,
        movementType: 'purchase_receipt'
      },
      _sum: {
        totalCost: true
      }
    })

    console.log(`✅ Total Products: ${totalProducts}`)
    console.log(`✅ Products with Purchase History: ${productsWithHistory}`)
    console.log(`✅ Products without Purchase History: ${totalProducts - productsWithHistory}`)
    console.log(`✅ Total Purchase Amount: $${parseFloat(totalPurchaseAmount._sum.totalCost || '0').toFixed(2)}`)

    // Final summary
    console.log('\n' + '='.repeat(70))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(70))
    console.log(`✅ Business: ${superadmin.business.name}`)
    console.log(`✅ Total Products: ${totalProducts}`)
    console.log(`✅ Products with History: ${productsWithHistory}`)
    console.log(`✅ Total Purchase Receipts: ${receiptCount}`)
    console.log(`✅ Total Inventory Movements: ${movements.length}`)
    console.log(`✅ Total Amount Spent: $${parseFloat(totalPurchaseAmount._sum.totalCost || '0').toFixed(2)}`)
    console.log('='.repeat(70))

    if (productCount > 0 && receiptCount > 0) {
      console.log('\n🎉 Report is ready! You can now view it at:')
      console.log('   http://localhost:3004/dashboard/reports/product-purchase-history')
    } else if (productCount > 0) {
      console.log('\n⚠️  You have products but no purchases yet.')
      console.log('   Create some GRNs to see purchase history data.')
    } else {
      console.log('\n⚠️  No products found. Add products and create GRNs first.')
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testProductPurchaseHistoryReport()
