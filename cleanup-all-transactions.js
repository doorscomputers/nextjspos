/**
 * Cleanup All Transactions Script
 *
 * Purpose: Delete all transactional data while preserving master data
 *
 * PRESERVES (Master Data):
 * - Users, Roles, Permissions
 * - Business, BusinessLocations
 * - Products, ProductVariations
 * - Suppliers, Customers
 * - Categories, Brands
 * - Tax Rates, Payment Methods
 *
 * DELETES (Transactional Data):
 * - Purchase Orders & Receipts
 * - Sales Transactions
 * - Stock Transfers
 * - Inventory Corrections
 * - Returns (Purchase & Customer)
 * - Serial Numbers
 * - Bank Transactions
 * - Accounts Payable
 * - Payments
 * - Audit Logs (optional)
 * - Cashier Shifts & Readings
 */

const { PrismaClient } = require('@prisma/client')
const readline = require('readline')

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function getTransactionCounts() {
  console.log('\n📊 Current Transaction Counts:')
  console.log('================================')

  const counts = {
    purchaseOrders: await prisma.purchase.count(),
    purchaseReceipts: await prisma.purchaseReceipt.count(),
    purchaseReturns: await prisma.purchaseReturn.count(),
    sales: await prisma.sale.count(),
    customerReturns: await prisma.customerReturn.count(),
    stockTransfers: await prisma.stockTransfer.count(),
    inventoryCorrections: await prisma.inventoryCorrection.count(),
    serialNumbers: await prisma.productSerialNumber.count(),
    accountsPayable: await prisma.accountsPayable.count(),
    payments: await prisma.payment.count(),
    bankTransactions: await prisma.bankTransaction.count(),
    auditLogs: await prisma.auditLog.count(),
    cashierShifts: await prisma.cashierShift.count(),
  }

  Object.entries(counts).forEach(([key, count]) => {
    const label = key.replace(/([A-Z])/g, ' $1').trim()
    console.log(`  ${label}: ${count}`)
  })

  const totalTransactions = Object.values(counts).reduce((sum, count) => sum + count, 0)
  console.log(`\n  TOTAL TRANSACTIONS: ${totalTransactions}`)

  return counts
}

async function getMasterDataCounts() {
  console.log('\n📚 Master Data (Will be Preserved):')
  console.log('====================================')

  const counts = {
    businesses: await prisma.business.count(),
    locations: await prisma.businessLocation.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    products: await prisma.product.count(),
    variations: await prisma.productVariation.count(),
    suppliers: await prisma.supplier.count(),
    customers: await prisma.customer.count(),
  }

  Object.entries(counts).forEach(([key, count]) => {
    const label = key.replace(/([A-Z])/g, ' $1').trim()
    console.log(`  ${label}: ${count}`)
  })

  return counts
}

async function deleteTransactions(deleteAuditLogs = false) {
  console.log('\n🗑️  Deleting Transactional Data...')
  console.log('===================================\n')

  const deletionOrder = [
    // Order matters due to foreign key constraints

    // 1. Delete Cashier Shifts first
    {
      name: 'Cashier Shifts',
      action: async () => {
        const count = await prisma.cashierShift.count()
        await prisma.cashierShift.deleteMany({})
        return count
      }
    },

    // 2. Delete Bank Transactions (depend on payments)
    {
      name: 'Bank Transactions',
      action: async () => {
        const count = await prisma.bankTransaction.count()
        await prisma.bankTransaction.deleteMany({})
        return count
      }
    },

    // 3. Delete Payments (depend on accounts payable)
    {
      name: 'Payments',
      action: async () => {
        const count = await prisma.payment.count()
        await prisma.payment.deleteMany({})
        return count
      }
    },

    // 4. Delete Accounts Payable (depend on purchases)
    {
      name: 'Accounts Payable',
      action: async () => {
        const count = await prisma.accountsPayable.count()
        await prisma.accountsPayable.deleteMany({})
        return count
      }
    },

    // 5. Delete Serial Number Movements
    {
      name: 'Serial Number Movements',
      action: async () => {
        const count = await prisma.serialNumberMovement.count()
        await prisma.serialNumberMovement.deleteMany({})
        return count
      }
    },

    // 6. Delete Serial Numbers
    {
      name: 'Product Serial Numbers',
      action: async () => {
        const count = await prisma.productSerialNumber.count()
        await prisma.productSerialNumber.deleteMany({})
        return count
      }
    },

    // 7. Delete Customer Returns (depend on sales)
    {
      name: 'Customer Return Items',
      action: async () => {
        const count = await prisma.customerReturnItem.count()
        await prisma.customerReturnItem.deleteMany({})
        return count
      }
    },
    {
      name: 'Customer Returns',
      action: async () => {
        const count = await prisma.customerReturn.count()
        await prisma.customerReturn.deleteMany({})
        return count
      }
    },

    // 8. Delete Purchase Returns (depend on receipts)
    {
      name: 'Purchase Return Items',
      action: async () => {
        const count = await prisma.purchaseReturnItem.count()
        await prisma.purchaseReturnItem.deleteMany({})
        return count
      }
    },
    {
      name: 'Purchase Returns',
      action: async () => {
        const count = await prisma.purchaseReturn.count()
        await prisma.purchaseReturn.deleteMany({})
        return count
      }
    },

    // 9. Delete Sales
    {
      name: 'Sale Payments',
      action: async () => {
        const count = await prisma.salePayment.count()
        await prisma.salePayment.deleteMany({})
        return count
      }
    },
    {
      name: 'Sale Items',
      action: async () => {
        const count = await prisma.saleItem.count()
        await prisma.saleItem.deleteMany({})
        return count
      }
    },
    {
      name: 'Sales',
      action: async () => {
        const count = await prisma.sale.count()
        await prisma.sale.deleteMany({})
        return count
      }
    },

    // 10. Delete Stock Transfers
    {
      name: 'Stock Transfer Items',
      action: async () => {
        const count = await prisma.stockTransferItem.count()
        await prisma.stockTransferItem.deleteMany({})
        return count
      }
    },
    {
      name: 'Stock Transfers',
      action: async () => {
        const count = await prisma.stockTransfer.count()
        await prisma.stockTransfer.deleteMany({})
        return count
      }
    },

    // 11. Delete Inventory Corrections
    {
      name: 'Inventory Corrections',
      action: async () => {
        const count = await prisma.inventoryCorrection.count()
        await prisma.inventoryCorrection.deleteMany({})
        return count
      }
    },

    // 12. Delete Purchase Receipts (depend on purchases)
    {
      name: 'Purchase Receipt Items',
      action: async () => {
        const count = await prisma.purchaseReceiptItem.count()
        await prisma.purchaseReceiptItem.deleteMany({})
        return count
      }
    },
    {
      name: 'Purchase Receipts',
      action: async () => {
        const count = await prisma.purchaseReceipt.count()
        await prisma.purchaseReceipt.deleteMany({})
        return count
      }
    },

    // 13. Delete Purchase Orders
    {
      name: 'Purchase Items',
      action: async () => {
        const count = await prisma.purchaseItem.count()
        await prisma.purchaseItem.deleteMany({})
        return count
      }
    },
    {
      name: 'Purchase Amendments',
      action: async () => {
        const count = await prisma.purchaseAmendment.count()
        await prisma.purchaseAmendment.deleteMany({})
        return count
      }
    },
    {
      name: 'Purchase Orders',
      action: async () => {
        const count = await prisma.purchase.count()
        await prisma.purchase.deleteMany({})
        return count
      }
    },

    // 14. Reset VariationLocationDetails (inventory levels)
    {
      name: 'Reset Inventory Levels',
      action: async () => {
        const count = await prisma.variationLocationDetails.count()
        await prisma.variationLocationDetails.updateMany({
          data: {
            qtyAvailable: 0,
            qtyAllocated: 0,
            qtyInTransit: 0,
          }
        })
        return count
      }
    },

    // 15. Audit Logs (optional - only if user confirms)
    ...(deleteAuditLogs ? [{
      name: 'Audit Logs',
      action: async () => {
        const count = await prisma.auditLog.count()
        await prisma.auditLog.deleteMany({})
        return count
      }
    }] : [])
  ]

  let totalDeleted = 0

  for (const { name, action } of deletionOrder) {
    try {
      const count = await action()
      console.log(`  ✓ Deleted ${count.toLocaleString()} ${name}`)
      totalDeleted += count
    } catch (error) {
      console.error(`  ✗ Error deleting ${name}:`, error.message)
    }
  }

  console.log(`\n  TOTAL RECORDS DELETED: ${totalDeleted.toLocaleString()}`)
}

async function verifyCleanup() {
  console.log('\n✅ Verification:')
  console.log('================')

  const transactionCounts = await getTransactionCounts()
  const masterDataCounts = await getMasterDataCounts()

  const totalTransactions = Object.values(transactionCounts).reduce((sum, count) => sum + count, 0)
  const totalMasterData = Object.values(masterDataCounts).reduce((sum, count) => sum + count, 0)

  console.log(`\n📊 Summary:`)
  console.log(`  Total Transactions Remaining: ${totalTransactions}`)
  console.log(`  Total Master Data Preserved: ${totalMasterData}`)

  if (totalTransactions === 0 || (totalTransactions === transactionCounts.auditLogs && totalTransactions > 0)) {
    console.log(`\n✅ SUCCESS: All transactional data has been cleaned!`)
    return true
  } else {
    console.log(`\n⚠️  WARNING: Some transactions still remain. Please review.`)
    return false
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  🧹 CLEANUP ALL TRANSACTIONS SCRIPT')
  console.log('='.repeat(60))
  console.log('\nThis script will DELETE all transactional data while')
  console.log('PRESERVING all master data (users, products, locations, etc.)')
  console.log('\n⚠️  WARNING: This action CANNOT be undone!')
  console.log('           Make sure you have a database backup!\n')

  // Show current state
  await getTransactionCounts()
  await getMasterDataCounts()

  // Confirm deletion
  const confirm1 = await question('\n❓ Are you sure you want to DELETE all transactions? (yes/no): ')

  if (confirm1.toLowerCase() !== 'yes') {
    console.log('\n❌ Cleanup cancelled.')
    rl.close()
    await prisma.$disconnect()
    return
  }

  const confirm2 = await question('❓ Type "DELETE ALL TRANSACTIONS" to confirm: ')

  if (confirm2 !== 'DELETE ALL TRANSACTIONS') {
    console.log('\n❌ Cleanup cancelled. Confirmation text did not match.')
    rl.close()
    await prisma.$disconnect()
    return
  }

  const deleteAuditLogsAnswer = await question('❓ Also delete Audit Logs? (yes/no): ')
  const deleteAuditLogs = deleteAuditLogsAnswer.toLowerCase() === 'yes'

  console.log('\n🚀 Starting cleanup...')

  try {
    await deleteTransactions(deleteAuditLogs)
    await verifyCleanup()

    console.log('\n' + '='.repeat(60))
    console.log('  ✅ CLEANUP COMPLETED SUCCESSFULLY')
    console.log('='.repeat(60))
    console.log('\nYou can now run tests with clean transactional data.')
    console.log('All master data (users, products, locations, etc.) has been preserved.\n')
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    console.error('\nStack trace:', error.stack)
    console.log('\n⚠️  Cleanup may be incomplete. Please review the error and try again.')
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { deleteTransactions, getTransactionCounts, getMasterDataCounts, verifyCleanup }
