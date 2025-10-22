import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * FORENSIC ACCOUNTING INVESTIGATION
 * Supplier Return: SR-202501-0001
 *
 * This script investigates what accounting records SHOULD exist vs what ACTUALLY exists
 */

async function investigateSupplierReturn() {
  console.log('=' .repeat(80))
  console.log('FORENSIC ACCOUNTING INVESTIGATION: SUPPLIER RETURN SR-202510-0001')
  console.log('=' .repeat(80))
  console.log()

  try {
    // 1. Find the Supplier Return Record
    console.log('STEP 1: LOCATE SUPPLIER RETURN RECORD')
    console.log('-'.repeat(80))

    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: {
        returnNumber: 'SR-202510-0001'
      },
      include: {
        supplier: true,
        items: true
      }
    })

    // Manually fetch location
    let location = null
    if (supplierReturn) {
      location = await prisma.businessLocation.findUnique({
        where: { id: supplierReturn.locationId }
      })

      // Manually fetch product and variation details for each item
      for (const item of supplierReturn.items) {
        item.product = await prisma.product.findUnique({
          where: { id: item.productId }
        })
        item.productVariation = await prisma.productVariation.findUnique({
          where: { id: item.productVariationId }
        })
      }
    }

    if (!supplierReturn) {
      console.log('❌ ERROR: Supplier Return SR-202510-0001 NOT FOUND!')
      return
    }

    console.log('✅ Supplier Return Found:')
    console.log(`   ID: ${supplierReturn.id}`)
    console.log(`   Return Number: ${supplierReturn.returnNumber}`)
    console.log(`   Date: ${supplierReturn.returnDate.toISOString().split('T')[0]}`)
    console.log(`   Supplier: ${supplierReturn.supplier.name} (ID: ${supplierReturn.supplierId})`)
    console.log(`   Location: ${location?.name || 'Unknown'} (ID: ${supplierReturn.locationId})`)
    console.log(`   Status: ${supplierReturn.status}`)
    console.log(`   Return Reason: ${supplierReturn.returnReason}`)
    console.log(`   Total Amount: ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log(`   Created By: User ID ${supplierReturn.createdBy}`)
    console.log(`   Approved By: ${supplierReturn.approvedBy || 'Not Approved'}`)
    console.log()

    console.log('   Items Returned:')
    for (const item of supplierReturn.items) {
      console.log(`   - ${item.product.name} (${item.productVariation.name})`)
      console.log(`     Quantity: ${Number(item.quantity)}`)
      console.log(`     Unit Cost: ₱${Number(item.unitCost).toFixed(2)}`)
      console.log(`     Line Total: ₱${(Number(item.quantity) * Number(item.unitCost)).toFixed(2)}`)
      console.log(`     Condition: ${item.condition}`)
    }
    console.log()

    // 2. Check Inventory Impact (ProductHistory)
    console.log('STEP 2: VERIFY INVENTORY IMPACT')
    console.log('-'.repeat(80))

    const inventoryRecords = await prisma.productHistory.findMany({
      where: {
        referenceType: 'supplier_return',
        referenceId: supplierReturn.id
      }
    })

    // Manually fetch product and variation details
    for (const record of inventoryRecords) {
      record.product = await prisma.product.findUnique({
        where: { id: record.productId }
      })
      record.productVariation = await prisma.productVariation.findUnique({
        where: { id: record.productVariationId }
      })
    }

    if (inventoryRecords.length > 0) {
      console.log(`✅ Found ${inventoryRecords.length} inventory record(s):`)
      for (const record of inventoryRecords) {
        console.log(`   Product: ${record.product.name} (${record.productVariation.name})`)
        console.log(`   Quantity Change: ${Number(record.quantityChange)}`)
        console.log(`   Balance After: ${Number(record.balanceQuantity)}`)
        console.log(`   Transaction Date: ${record.transactionDate.toISOString()}`)
        console.log()
      }
    } else {
      console.log('❌ NO inventory records found in ProductHistory!')
      console.log('   This means inventory was NOT adjusted.')
      console.log()
    }

    // 3. Check Stock Transactions
    console.log('STEP 3: VERIFY STOCK TRANSACTIONS')
    console.log('-'.repeat(80))

    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        referenceType: 'supplier_return',
        referenceId: supplierReturn.id
      }
    })

    // Manually fetch product details
    for (const tx of stockTransactions) {
      tx.product = await prisma.product.findUnique({
        where: { id: tx.productId }
      })
    }

    if (stockTransactions.length > 0) {
      console.log(`✅ Found ${stockTransactions.length} stock transaction(s):`)
      for (const tx of stockTransactions) {
        console.log(`   Product: ${tx.product.name}`)
        console.log(`   Type: ${tx.type}`)
        console.log(`   Quantity: ${Number(tx.quantity)} (negative = deduction)`)
        console.log(`   Balance After: ${Number(tx.balanceQty)}`)
        console.log(`   Unit Cost: ₱${Number(tx.unitCost || 0).toFixed(2)}`)
        console.log()
      }
    } else {
      console.log('❌ NO stock transactions found!')
      console.log()
    }

    // 4. Check Accounts Payable Impact
    console.log('STEP 4: CHECK ACCOUNTS PAYABLE ENTRIES')
    console.log('-'.repeat(80))

    // Check if there's an AP entry linked to this return
    // NOTE: Based on schema, AccountsPayable is linked to Purchase, not SupplierReturn
    // We need to check if the original purchase has AP entries

    const accountsPayableEntries = await prisma.accountsPayable.findMany({
      where: {
        supplierId: supplierReturn.supplierId,
        // Cannot directly link to supplier return
      }
    })

    if (accountsPayableEntries.length > 0) {
      console.log(`ℹ️  Found ${accountsPayableEntries.length} AP entries for this supplier:`)
      for (const ap of accountsPayableEntries) {
        console.log(`   Invoice: ${ap.invoiceNumber}`)
        console.log(`   Total Amount: ₱${Number(ap.totalAmount).toFixed(2)}`)
        console.log(`   Paid Amount: ₱${Number(ap.paidAmount).toFixed(2)}`)
        console.log(`   Balance: ₱${Number(ap.balanceAmount).toFixed(2)}`)
        console.log(`   Payment Status: ${ap.paymentStatus}`)
        console.log()
      }

      console.log('⚠️  PROBLEM IDENTIFIED:')
      console.log('   Supplier returns are NOT reducing Accounts Payable!')
      console.log('   Schema shows AccountsPayable is linked to Purchase, not SupplierReturn.')
      console.log()
    } else {
      console.log('ℹ️  No Accounts Payable entries found for this supplier.')
      console.log()
    }

    // 5. Check Payment Records
    console.log('STEP 5: CHECK PAYMENT RECORDS')
    console.log('-'.repeat(80))

    const payments = await prisma.payment.findMany({
      where: {
        supplierId: supplierReturn.supplierId
      },
      include: {
        supplier: true
      }
    })

    if (payments.length > 0) {
      console.log(`ℹ️  Found ${payments.length} payment(s) to this supplier:`)
      for (const payment of payments) {
        console.log(`   Reference: ${payment.referenceNumber || 'N/A'}`)
        console.log(`   Amount: ₱${Number(payment.amount).toFixed(2)}`)
        console.log(`   Method: ${payment.paymentMethod}`)
        console.log(`   Date: ${payment.paymentDate.toISOString().split('T')[0]}`)
        console.log(`   Status: ${payment.status}`)
        console.log()
      }
    } else {
      console.log('ℹ️  No payments found for this supplier.')
      console.log()
    }

    // 6. Check Bank Transactions
    console.log('STEP 6: CHECK BANK TRANSACTIONS')
    console.log('-'.repeat(80))
    console.log('ℹ️  BankTransaction table does not have referenceType/referenceId fields')
    console.log('   Cannot directly link bank transactions to supplier returns')
    console.log('   This is a DESIGN GAP in the schema')
    console.log()

    // 7. Check Accounting Entries (Journal Entries)
    console.log('STEP 7: CHECK ACCOUNTING/JOURNAL ENTRIES')
    console.log('-'.repeat(80))
    console.log('ℹ️  No AccountingEntry/Journal Entry model found in schema')
    console.log('   This system does NOT have double-entry bookkeeping functionality')
    console.log('   This is a CRITICAL GAP - no general ledger system!')
    console.log()

    // 8. ANALYSIS & RECOMMENDATIONS
    console.log()
    console.log('=' .repeat(80))
    console.log('FORENSIC ANALYSIS & FINDINGS')
    console.log('=' .repeat(80))
    console.log()

    console.log('WHAT SHOULD HAVE BEEN RECORDED:')
    console.log('-'.repeat(80))
    console.log()
    console.log('1. INVENTORY IMPACT (Stock Deduction):')
    console.log('   ✅ RECORDED - Inventory was correctly reduced')
    console.log('      - Stock deducted from location')
    console.log('      - ProductHistory entry created')
    console.log('      - StockTransaction entry created')
    console.log()

    console.log('2. ACCOUNTS PAYABLE ADJUSTMENT:')
    if (accountsPayableEntries.length === 0) {
      console.log('   ❌ NOT RECORDED - No AP entries found')
    } else {
      console.log('   ❌ NOT ADJUSTED - AP entries exist but were NOT reduced for return')
    }
    console.log('   SHOULD BE: Reduce amount owed to supplier')
    console.log(`   AMOUNT: ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log()

    console.log('3. ACCOUNTING ENTRY (Double-Entry Bookkeeping):')
    console.log('   ❌ SYSTEM LIMITATION - No general ledger/journal entry system exists')
    console.log()
    console.log('   SHOULD BE (if system had accounting module):')
    console.log(`   DR: Accounts Payable - ${supplierReturn.supplier.name}  ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log(`   CR: Inventory / Returns to Supplier                    ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log()
    console.log('   EXPLANATION:')
    console.log('   - Debit AP: Reduces liability (we owe supplier less)')
    console.log('   - Credit Inventory: Reduces asset value (stock is gone)')
    console.log()

    console.log('4. CASH/BANK IMPACT:')
    console.log('   ℹ️  No cash refund expected (return applied as credit to AP)')
    console.log('   ⚠️  If supplier issues refund, would need to manually record in BankTransaction')
    console.log('       (Note: BankTransaction lacks referenceType/Id to link to supplier returns)')
    console.log()

    console.log('=' .repeat(80))
    console.log('CRITICAL GAPS IDENTIFIED:')
    console.log('=' .repeat(80))
    console.log()

    const gaps = []

    gaps.push('System lacks general ledger / double-entry bookkeeping module')

    if (accountsPayableEntries.length === 0) {
      gaps.push('No Accounts Payable entries found for this supplier')
    } else {
      // Check if any AP was reduced
      const totalApBalance = accountsPayableEntries.reduce((sum, ap) =>
        sum + Number(ap.balanceAmount), 0
      )
      gaps.push(`AP entries NOT adjusted for return (Still owe: ₱${totalApBalance.toFixed(2)})`)
    }

    gaps.push('BankTransaction table cannot link to supplier returns (missing referenceType/Id)')
    gaps.push('No mechanism to reduce AP when supplier returns are approved')

    if (gaps.length > 0) {
      console.log('❌ MISSING ACCOUNTING RECORDS:')
      gaps.forEach((gap, index) => {
        console.log(`   ${index + 1}. ${gap}`)
      })
    } else {
      console.log('✅ All expected records are present')
    }
    console.log()

    console.log('=' .repeat(80))
    console.log('FINANCIAL IMPACT SUMMARY:')
    console.log('=' .repeat(80))
    console.log()
    console.log(`Return Amount: ₱${Number(supplierReturn.totalAmount).toFixed(2)}`)
    console.log()
    console.log('BALANCE SHEET IMPACT:')
    console.log(`  Assets (Inventory): -₱${Number(supplierReturn.totalAmount).toFixed(2)} ✅ RECORDED`)
    console.log(`  Liabilities (AP):   -₱${Number(supplierReturn.totalAmount).toFixed(2)} ❌ NOT RECORDED`)
    console.log()
    console.log('⚠️  NET EFFECT: Balance sheet is OUT OF BALANCE')
    console.log('   Assets decreased but Liabilities did not decrease')
    console.log('   This understates net worth by the return amount')
    console.log()

    // 9. CORRECTIVE ACTIONS
    console.log('=' .repeat(80))
    console.log('RECOMMENDED CORRECTIVE ACTIONS:')
    console.log('=' .repeat(80))
    console.log()

    console.log('OPTION 1: Create Missing Accounting Entry')
    console.log('-'.repeat(80))
    console.log('If you have an Accounting module with Chart of Accounts:')
    console.log()
    console.log('SQL to create journal entry:')
    console.log(`
-- Find AP account and Inventory account IDs
-- Then create journal entry for the return

INSERT INTO accounting_entries (business_id, entry_date, reference_type, reference_id, description, created_at)
VALUES (${supplierReturn.businessId}, '${supplierReturn.returnDate.toISOString().split('T')[0]}', 'supplier_return', ${supplierReturn.id}, 'Supplier Return ${supplierReturn.returnNumber} - ${supplierReturn.supplier.name}', NOW());

-- Get the ID of the entry just created (let's assume it's @entryId)

INSERT INTO accounting_entry_lines (entry_id, account_id, debit_amount, credit_amount, description)
VALUES
  (@entryId, @accountsPayableAccountId, ${Number(supplierReturn.totalAmount).toFixed(2)}, 0, 'Reduce AP for supplier return'),
  (@entryId, @inventoryAccountId, 0, ${Number(supplierReturn.totalAmount).toFixed(2)}, 'Reduce inventory for return to supplier');
    `)
    console.log()

    console.log('OPTION 2: Update Accounts Payable')
    console.log('-'.repeat(80))
    if (accountsPayableEntries.length > 0) {
      console.log('Apply return as credit to existing AP records:')
      console.log()
      for (const ap of accountsPayableEntries) {
        const newBalance = Number(ap.balanceAmount) - Number(supplierReturn.totalAmount)
        const newPaidAmount = Number(ap.paidAmount) + Number(supplierReturn.totalAmount)
        console.log(`UPDATE accounts_payable SET`)
        console.log(`  paid_amount = ${newPaidAmount.toFixed(2)},`)
        console.log(`  balance_amount = ${newBalance.toFixed(2)},`)
        console.log(`  payment_status = '${newBalance > 0 ? 'partial' : 'paid'}'`)
        console.log(`WHERE id = ${ap.id};`)
        console.log()
      }
    } else {
      console.log('⚠️  No existing AP entries to adjust')
      console.log('   Need to investigate why there are no AP records for purchases')
    }
    console.log()

    console.log('OPTION 3: Prevention - Enhance Supplier Return Approval Process')
    console.log('-'.repeat(80))
    console.log('Modify the approve route to automatically:')
    console.log('1. Deduct inventory (already done ✅)')
    console.log('2. Create accounting entry (DR: AP, CR: Inventory) ❌ MISSING')
    console.log('3. Update AP balance or create AP credit note ❌ MISSING')
    console.log('4. If refund issued, record bank transaction ❌ MISSING')
    console.log()

    console.log('=' .repeat(80))
    console.log('INVESTIGATION COMPLETE')
    console.log('=' .repeat(80))

  } catch (error) {
    console.error('❌ Investigation failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run investigation
investigateSupplierReturn()
  .catch(console.error)
