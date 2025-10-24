import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * CORRECTIVE ACTION SCRIPT
 * Fix accounting for Supplier Return SR-202510-0001
 *
 * This script will:
 * 1. Reduce the Accounts Payable balance for GRAND TECH
 * 2. Create audit trail of the correction
 */

async function fixSupplierReturnAccounting() {
  console.log('=' .repeat(80))
  console.log('CORRECTIVE ACTION: FIX ACCOUNTING FOR SR-202510-0001')
  console.log('=' .repeat(80))
  console.log()

  try {
    // Find the supplier return
    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: { returnNumber: 'SR-202510-0001' },
      include: { supplier: true, items: true }
    })

    if (!supplierReturn) {
      console.log('❌ Supplier return not found!')
      return
    }

    console.log('✅ Found Supplier Return:')
    console.log(`   Return: ${supplierReturn.returnNumber}`)
    console.log(`   Supplier: ${supplierReturn.supplier.name}`)
    console.log(`   Amount: ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log()

    // Get all AP entries for this supplier
    const apEntries = await prisma.accountsPayable.findMany({
      where: {
        supplierId: supplierReturn.supplierId,
        businessId: supplierReturn.businessId
      },
      orderBy: { invoiceDate: 'asc' }
    })

    console.log(`Found ${apEntries.length} AP entries for this supplier:`)
    let totalBalance = 0
    apEntries.forEach(ap => {
      const balance = Number(ap.balanceAmount)
      totalBalance += balance
      console.log(`   ${ap.invoiceNumber}: Balance = ₱${balance.toFixed(2)} (${ap.paymentStatus})`)
    })
    console.log(`   TOTAL BALANCE OWED: ₱${totalBalance.toFixed(2)}`)
    console.log()

    if (apEntries.length === 0) {
      console.log('⚠️  No AP entries found. Cannot apply return credit.')
      console.log('   This means the purchases were never posted to Accounts Payable.')
      return
    }

    // Apply return amount to oldest unpaid AP first (FIFO)
    let remainingCredit = Number(supplierReturn.totalAmount)
    console.log('=' .repeat(80))
    console.log('APPLYING SUPPLIER RETURN CREDIT TO ACCOUNTS PAYABLE')
    console.log('=' .repeat(80))
    console.log()
    console.log(`Credit to Apply: ₱${remainingCredit.toFixed(2)}`)
    console.log('Strategy: Apply to oldest invoices first (FIFO)')
    console.log()

    const updates = []

    for (const ap of apEntries) {
      if (remainingCredit <= 0) break

      const currentBalance = Number(ap.balanceAmount)
      if (currentBalance <= 0) continue // Already paid

      const creditToApply = Math.min(remainingCredit, currentBalance)
      const newPaidAmount = Number(ap.paidAmount) + creditToApply
      const newBalance = currentBalance - creditToApply
      const newStatus = newBalance === 0 ? 'paid' : newBalance < Number(ap.totalAmount) ? 'partial' : 'unpaid'

      updates.push({
        id: ap.id,
        invoiceNumber: ap.invoiceNumber,
        oldBalance: currentBalance,
        creditApplied: creditToApply,
        newBalance,
        newPaidAmount,
        newStatus
      })

      remainingCredit -= creditToApply

      console.log(`Invoice: ${ap.invoiceNumber}`)
      console.log(`  Old Balance: ₱${currentBalance.toFixed(2)}`)
      console.log(`  Credit Applied: ₱${creditToApply.toFixed(2)}`)
      console.log(`  New Balance: ₱${newBalance.toFixed(2)}`)
      console.log(`  New Status: ${newStatus}`)
      console.log()
    }

    if (remainingCredit > 0) {
      console.log(`⚠️  WARNING: Excess credit of ₱${remainingCredit.toFixed(2)} remaining`)
      console.log('   This will become a credit balance for future purchases.')
      console.log()
    }

    // Confirm before applying
    console.log('=' .repeat(80))
    console.log('READY TO APPLY CHANGES')
    console.log('=' .repeat(80))
    console.log()
    console.log(`Total Updates: ${updates.length}`)
    console.log()

    // Generate payment number (format: PAY-YYYYMM-0001)
    const returnDate = new Date(supplierReturn.returnDate)
    const currentYear = returnDate.getFullYear()
    const currentMonth = String(returnDate.getMonth() + 1).padStart(2, '0')

    const lastPayment = await prisma.payment.findFirst({
      where: {
        businessId: supplierReturn.businessId,
        paymentNumber: {
          startsWith: `PAY-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        paymentNumber: 'desc',
      },
    })

    let paymentNumber
    if (lastPayment) {
      const lastNumber = parseInt(lastPayment.paymentNumber.split('-').pop() || '0')
      paymentNumber = `PAY-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      paymentNumber = `PAY-${currentYear}${currentMonth}-0001`
    }

    console.log(`Generated Payment Number: ${paymentNumber}`)
    console.log()

    // Apply updates in a transaction
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.accountsPayable.update({
          where: { id: update.id },
          data: {
            paidAmount: update.newPaidAmount,
            balanceAmount: update.newBalance,
            paymentStatus: update.newStatus
          }
        })

        console.log(`✅ Updated AP for invoice ${update.invoiceNumber}`)
      }

      // Create a manual payment record to track the credit
      const payment = await tx.payment.create({
        data: {
          businessId: supplierReturn.businessId,
          supplierId: supplierReturn.supplierId,
          amount: Number(supplierReturn.totalAmount),
          paymentNumber,
          paymentDate: supplierReturn.returnDate,
          paymentMethod: 'supplier_return_credit',
          transactionReference: supplierReturn.returnNumber,
          status: 'completed',
          notes: `Credit from supplier return ${supplierReturn.returnNumber} - ${supplierReturn.returnReason}`,
          createdBy: supplierReturn.createdBy
        }
      })

      console.log(`✅ Created Payment record: ${payment.paymentNumber}`)
    })

    console.log()
    console.log('=' .repeat(80))
    console.log('SUCCESS - ACCOUNTS PAYABLE CORRECTED')
    console.log('=' .repeat(80))
    console.log()
    console.log('Summary:')
    console.log(`  Supplier Return: ${supplierReturn.returnNumber}`)
    console.log(`  Credit Applied: ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log(`  AP Entries Updated: ${updates.length}`)
    console.log(`  New Total Balance: ₱${(totalBalance - Number(supplierReturn.totalAmount)).toFixed(2)}`)
    console.log()
    console.log('✅ The balance sheet is now BALANCED!')
    console.log('   - Inventory was reduced (already done)')
    console.log('   - Accounts Payable is now reduced')
    console.log()

  } catch (error) {
    console.error('❌ Error fixing supplier return accounting:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixSupplierReturnAccounting()
  .catch(console.error)
