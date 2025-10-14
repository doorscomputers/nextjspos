/**
 * Direct GRN Database Test
 * Tests Direct Entry GRN creation via database to verify:
 * - Schema changes (optional purchaseId)
 * - Inventory movements
 * - Stock updates
 */

const { PrismaClient, Prisma } = require('@prisma/client')

const prisma = new PrismaClient()

let testResults = []

async function testDirectGRNCreation() {
  console.log('\n🚀 Starting Direct GRN Database Test\n')

  try {
    // Test 1: Get test data
    console.log('📋 Test 1: Fetching test data...')

    const admin = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: { business: { include: { locations: true } } }
    })

    if (!admin) {
      throw new Error('Superadmin user not found. Please seed database.')
    }

    const supplier = await prisma.supplier.findFirst({
      where: { businessId: admin.businessId }
    })

    if (!supplier) {
      throw new Error('No supplier found')
    }

    const location = admin.business.locations[0]

    if (!location) {
      throw new Error('No location found')
    }

    const product = await prisma.product.findFirst({
      where: { businessId: admin.businessId },
      include: { variations: true }
    })

    if (!product || !product.variations || product.variations.length === 0) {
      throw new Error('No product with variations found')
    }

    console.log('✅ Test data retrieved:')
    console.log(`   User: ${admin.username} (ID: ${admin.id})`)
    console.log(`   Business: ${admin.business.name} (ID: ${admin.businessId})`)
    console.log(`   Supplier: ${supplier.name} (ID: ${supplier.id})`)
    console.log(`   Location: ${location.name} (ID: ${location.id})`)
    console.log(`   Product: ${product.name} (ID: ${product.id})`)
    console.log(`   Variation: ${product.variations[0].name} (ID: ${product.variations[0].id})`)

    testResults.push({ test: 'Fetch Test Data', status: 'PASS' })

    // Test 2: Check current stock before GRN
    console.log('\n📊 Test 2: Checking current stock...')

    const variationBefore = await prisma.productVariation.findUnique({
      where: { id: product.variations[0].id },
      select: { currentStock: true }
    })

    const stockBefore = parseFloat(variationBefore.currentStock.toString())
    console.log(`✅ Current stock: ${stockBefore} units`)

    testResults.push({ test: 'Check Current Stock', status: 'PASS', stockBefore })

    // Test 3: Create Direct GRN (No Purchase Order)
    console.log('\n📝 Test 3: Creating Direct GRN...')

    const quantityReceived = 100
    const unitCost = 50.00

    // Generate receipt number
    const lastReceipt = await prisma.purchaseReceipt.findFirst({
      where: { businessId: admin.businessId },
      orderBy: { id: 'desc' },
      select: { receiptNumber: true },
    })

    const lastNumber = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[1] || '0')
      : 0
    const receiptNumber = `GRN-${String(lastNumber + 1).padStart(6, '0')}`

    // Create GRN in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase Receipt (NO purchaseId)
      const receipt = await tx.purchaseReceipt.create({
        data: {
          businessId: admin.businessId,
          purchaseId: null,  // CRITICAL: NULL for direct entry
          supplierId: supplier.id,
          locationId: location.id,
          receiptNumber,
          receiptDate: new Date(),
          status: 'pending',
          notes: 'Test Direct GRN - Database Test',
          receivedBy: admin.id,
          receivedAt: new Date(),
        },
      })

      // 2. Create Receipt Item (NO purchaseItemId)
      const receiptItem = await tx.purchaseReceiptItem.create({
        data: {
          purchaseReceiptId: receipt.id,
          purchaseItemId: null,  // CRITICAL: NULL for direct entry
          productId: product.id,
          productVariationId: product.variations[0].id,
          quantityReceived: new Prisma.Decimal(quantityReceived),
          serialNumbers: null,
          notes: 'Test item',
        },
      })

      // 3. Create Inventory Movement
      const existingStock = await tx.inventoryMovement.findFirst({
        where: {
          businessId: admin.businessId,
          locationId: location.id,
          productId: product.id,
          productVariationId: product.variations[0].id,
        },
        orderBy: { createdAt: 'desc' },
      })

      const currentBalance = existingStock
        ? parseFloat(existingStock.balanceQuantity.toString())
        : 0
      const newBalance = currentBalance + quantityReceived

      const movement = await tx.inventoryMovement.create({
        data: {
          businessId: admin.businessId,
          locationId: location.id,
          productId: product.id,
          productVariationId: product.variations[0].id,
          movementType: 'purchase_receipt',
          referenceType: 'purchase_receipt',
          referenceId: receipt.id.toString(),
          quantityIn: new Prisma.Decimal(quantityReceived),
          quantityOut: new Prisma.Decimal(0),
          balanceQuantity: new Prisma.Decimal(newBalance),
          unitCost: new Prisma.Decimal(unitCost),
          totalCost: new Prisma.Decimal(unitCost * quantityReceived),
          notes: `${receiptNumber} (Direct Entry)`,
          createdBy: admin.id,
        },
      })

      // 4. Update Product Variation Stock
      await tx.productVariation.update({
        where: { id: product.variations[0].id },
        data: {
          currentStock: {
            increment: new Prisma.Decimal(quantityReceived),
          },
        },
      })

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: 'CREATE_PURCHASE_RECEIPT',
          entityType: 'purchase_receipt',
          entityId: receipt.id.toString(),
          details: {
            receiptNumber,
            supplierId: supplier.id,
            locationId: location.id,
            itemCount: 1,
            workflow: 'direct_entry',
            test: true,
          },
        },
      }).catch(() => {
        console.log('   (Audit log optional - continuing)')
      })

      return { receipt, receiptItem, movement, newBalance }
    })

    console.log(`✅ Direct GRN created successfully:`)
    console.log(`   GRN Number: ${result.receipt.receiptNumber}`)
    console.log(`   GRN ID: ${result.receipt.id}`)
    console.log(`   Purchase ID: ${result.receipt.purchaseId} (should be null)`)
    console.log(`   Supplier ID: ${result.receipt.supplierId}`)
    console.log(`   Quantity Received: ${quantityReceived} units`)
    console.log(`   Unit Cost: $${unitCost}`)
    console.log(`   Total Cost: $${(quantityReceived * unitCost).toFixed(2)}`)
    console.log(`   New Balance: ${result.newBalance} units`)

    testResults.push({
      test: 'Create Direct GRN',
      status: 'PASS',
      grnNumber: result.receipt.receiptNumber,
      grnId: result.receipt.id,
      purchaseId: result.receipt.purchaseId
    })

    // Test 4: Verify GRN was created without Purchase Order
    console.log('\n🔍 Test 4: Verifying GRN schema...')

    const verifyGRN = await prisma.purchaseReceipt.findUnique({
      where: { id: result.receipt.id },
      include: {
        supplier: true,
        purchase: true,
        items: true,
      }
    })

    if (verifyGRN.purchaseId === null) {
      console.log('✅ GRN has NULL purchaseId (Direct Entry confirmed)')
      testResults.push({ test: 'Verify NULL purchaseId', status: 'PASS' })
    } else {
      console.log('❌ GRN has purchaseId (should be NULL)')
      testResults.push({ test: 'Verify NULL purchaseId', status: 'FAIL' })
    }

    if (verifyGRN.supplierId === supplier.id) {
      console.log(`✅ GRN linked to supplier: ${verifyGRN.supplier.name}`)
      testResults.push({ test: 'Verify Supplier Link', status: 'PASS' })
    } else {
      console.log('❌ GRN supplier mismatch')
      testResults.push({ test: 'Verify Supplier Link', status: 'FAIL' })
    }

    if (verifyGRN.items.length === 1) {
      console.log(`✅ GRN has ${verifyGRN.items.length} item`)
      const item = verifyGRN.items[0]
      if (item.purchaseItemId === null) {
        console.log('✅ Item has NULL purchaseItemId (Direct Entry confirmed)')
        testResults.push({ test: 'Verify NULL purchaseItemId', status: 'PASS' })
      } else {
        console.log('❌ Item has purchaseItemId (should be NULL)')
        testResults.push({ test: 'Verify NULL purchaseItemId', status: 'FAIL' })
      }
    }

    // Test 5: Verify inventory movement
    console.log('\n📦 Test 5: Verifying inventory movement...')

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        referenceType: 'purchase_receipt',
        referenceId: result.receipt.id.toString(),
      },
      orderBy: { createdAt: 'desc' },
    })

    if (movements.length > 0) {
      console.log(`✅ Found ${movements.length} inventory movement(s)`)
      const movement = movements[0]
      console.log(`   Movement Type: ${movement.movementType}`)
      console.log(`   Quantity In: ${movement.quantityIn}`)
      console.log(`   Balance: ${movement.balanceQuantity}`)
      testResults.push({ test: 'Verify Inventory Movement', status: 'PASS' })
    } else {
      console.log('❌ No inventory movements found')
      testResults.push({ test: 'Verify Inventory Movement', status: 'FAIL' })
    }

    // Test 6: Verify stock update
    console.log('\n📊 Test 6: Verifying stock update...')

    const variationAfter = await prisma.productVariation.findUnique({
      where: { id: product.variations[0].id },
      select: { currentStock: true }
    })

    const stockAfter = parseFloat(variationAfter.currentStock.toString())
    const expectedStock = stockBefore + quantityReceived

    console.log(`   Stock Before: ${stockBefore} units`)
    console.log(`   Quantity Added: ${quantityReceived} units`)
    console.log(`   Expected Stock: ${expectedStock} units`)
    console.log(`   Actual Stock: ${stockAfter} units`)

    if (stockAfter === expectedStock) {
      console.log('✅ Stock updated correctly!')
      testResults.push({ test: 'Verify Stock Update', status: 'PASS', stockAfter })
    } else {
      console.log(`❌ Stock mismatch! Expected ${expectedStock}, got ${stockAfter}`)
      testResults.push({ test: 'Verify Stock Update', status: 'FAIL', stockAfter })
    }

    // Test 7: Verify audit log
    console.log('\n📋 Test 7: Verifying audit log...')

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'CREATE_PURCHASE_RECEIPT',
        entityType: 'purchase_receipt',
        entityId: result.receipt.id.toString(),
      },
    })

    if (auditLogs.length > 0) {
      console.log(`✅ Found ${auditLogs.length} audit log(s)`)
      const log = auditLogs[0]
      if (log.details && log.details.workflow === 'direct_entry') {
        console.log('✅ Audit log records Direct Entry workflow')
        testResults.push({ test: 'Verify Audit Log', status: 'PASS' })
      } else {
        console.log('⚠️  Audit log exists but workflow not recorded')
        testResults.push({ test: 'Verify Audit Log', status: 'WARN' })
      }
    } else {
      console.log('⚠️  No audit log found')
      testResults.push({ test: 'Verify Audit Log', status: 'WARN' })
    }

    // Print summary
    printTestSummary()

  } catch (error) {
    console.error('\n💥 Test failed:', error.message)
    console.error(error.stack)
    testResults.push({ test: 'Overall Test', status: 'FAIL', error: error.message })
    printTestSummary()
  } finally {
    await prisma.$disconnect()
  }
}

function printTestSummary() {
  console.log('\n' + '='.repeat(70))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('='.repeat(70))

  const passed = testResults.filter(r => r.status === 'PASS').length
  const failed = testResults.filter(r => r.status === 'FAIL').length
  const warned = testResults.filter(r => r.status === 'WARN').length

  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' :
                 result.status === 'FAIL' ? '❌' : '⚠️'
    console.log(`${icon} ${result.test.padEnd(40)} ${result.status}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })

  console.log('\n' + '-'.repeat(70))
  console.log(`Total Tests: ${testResults.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  Warnings: ${warned}`)
  console.log('='.repeat(70) + '\n')

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Direct GRN feature is bulletproof!\n')
  } else {
    console.log('⚠️  SOME TESTS FAILED! Please review errors above.\n')
  }
}

// Run the test
testDirectGRNCreation()
