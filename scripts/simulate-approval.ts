import { PrismaClient } from '@prisma/client'
import { processSupplierReturn } from '../src/lib/stockOperations'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function simulateApproval() {
  console.log('🔍 Simulating Purchase Return Approval for RET-000001...\n')

  try {
    // Find RET-000001
    const purchaseReturn = await prisma.purchaseReturn.findFirst({
      where: {
        returnNumber: 'RET-000001',
      },
      include: {
        supplier: true,
        purchaseReceipt: {
          include: {
            purchase: true,
          },
        },
        items: {
          include: {
            purchaseReceiptItem: true,
            product: true,
            productVariation: true,
          },
        },
      },
    })

    if (!purchaseReturn) {
      console.log('❌ RET-000001 not found')
      return
    }

    console.log(`✅ Found ${purchaseReturn.returnNumber}`)
    console.log(`   Status: ${purchaseReturn.status}`)
    console.log(`   Business ID: ${purchaseReturn.businessId}`)
    console.log(`   Location ID: ${purchaseReturn.locationId}`)
    console.log(`   Supplier: ${purchaseReturn.supplier.name}`)
    console.log(`   Items: ${purchaseReturn.items.length}\n`)

    if (purchaseReturn.status !== 'pending') {
      console.log(`⚠️  Return is already ${purchaseReturn.status}`)
      return
    }

    // Simulate the transaction
    console.log('🔄 Starting simulated transaction...\n')

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update status
      console.log('1️⃣ Updating return status to approved...')
      const approvedReturn = await tx.purchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: 'approved',
          approvedBy: 1, // Assuming user ID 1
          approvedAt: new Date(),
        },
      })
      console.log('   ✅ Status updated\n')

      // 2. Process items
      console.log('2️⃣ Processing inventory reductions...')
      for (const item of purchaseReturn.items) {
        const returnQty = parseFloat(String(item.quantityReturned))
        const unitCost = item.unitCost ? parseFloat(String(item.unitCost)) : 0

        console.log(`   📦 Item: ${item.product.name}`)
        console.log(`      Product ID: ${item.productId}`)
        console.log(`      Variation ID: ${item.productVariationId}`)
        console.log(`      Qty to return: ${returnQty}`)
        console.log(`      Unit Cost: ₱${unitCost}`)

        if (returnQty > 0) {
          try {
            await processSupplierReturn({
              businessId: purchaseReturn.businessId,
              productId: item.productId,
              productVariationId: item.productVariationId,
              locationId: purchaseReturn.locationId,
              quantity: returnQty,
              unitCost,
              returnId: purchaseReturn.id,
              returnNumber: purchaseReturn.returnNumber,
              supplierName: purchaseReturn.supplier.name,
              returnReason: purchaseReturn.returnReason,
              userId: 1,
              userDisplayName: 'Test User',
              tx,
            })
            console.log('      ✅ Inventory reduced successfully')
          } catch (error: any) {
            console.error('      ❌ ERROR reducing inventory:', error.message)
            throw error
          }
        }
        console.log('')
      }

      // 3. Create debit note
      console.log('3️⃣ Creating debit note...')
      const debitNoteCount = await tx.debitNote.count({
        where: { businessId: purchaseReturn.businessId },
      })
      const debitNoteNumber = `DN-${String(debitNoteCount + 1).padStart(6, '0')}`

      const debitNote = await tx.debitNote.create({
        data: {
          businessId: purchaseReturn.businessId,
          supplierId: purchaseReturn.supplierId,
          purchaseReturnId: purchaseReturn.id,
          debitNoteNumber,
          debitNoteDate: new Date(),
          amount: purchaseReturn.totalAmount,
          status: 'pending',
          notes: `Debit note for return ${purchaseReturn.returnNumber}`,
          createdBy: 1,
        },
      })
      console.log(`   ✅ Debit note created: ${debitNoteNumber}\n`)

      // 4. Update AP if exists
      if (purchaseReturn.purchaseReceipt.purchaseId) {
        console.log('4️⃣ Updating accounts payable...')
        const accountsPayable = await tx.accountsPayable.findFirst({
          where: {
            businessId: purchaseReturn.businessId,
            purchaseId: purchaseReturn.purchaseReceipt.purchaseId,
          },
        })

        if (accountsPayable) {
          const currentBalance = parseFloat(String(accountsPayable.balanceAmount))
          const returnAmount = parseFloat(String(purchaseReturn.totalAmount))
          const newBalance = Math.max(0, currentBalance - returnAmount)

          const totalAmount = parseFloat(String(accountsPayable.totalAmount))
          const newPaidAmount = totalAmount - newBalance

          await tx.accountsPayable.update({
            where: { id: accountsPayable.id },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: newBalance,
              paymentStatus: newBalance <= 0 ? 'paid' : 'partial',
            },
          })
          console.log(`   ✅ AP updated: ₱${currentBalance} → ₱${newBalance}\n`)
        } else {
          console.log('   ⚠️  No AP record found\n')
        }
      }

      return { approvedReturn, debitNote }
    })

    console.log('✅ ✅ ✅ TRANSACTION COMPLETED SUCCESSFULLY! ✅ ✅ ✅\n')
    console.log('📊 Summary:')
    console.log(`   Return Status: approved`)
    console.log(`   Debit Note: ${result.debitNote.debitNoteNumber}`)
    console.log(`   Amount: ₱${result.debitNote.amount}`)

  } catch (error: any) {
    console.error('\n❌ ❌ ❌ TRANSACTION FAILED! ❌ ❌ ❌')
    console.error(`\nError: ${error.message}`)
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

simulateApproval().catch(console.error)
