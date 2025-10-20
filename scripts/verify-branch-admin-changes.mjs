/**
 * Verify Branch Admin Permission Changes
 *
 * This script verifies that the Branch Admin role has been correctly updated
 * to remove transactional permissions and add supervisory permissions.
 */

import { DEFAULT_ROLES, PERMISSIONS } from '../src/lib/rbac.ts'

console.log('='.repeat(60))
console.log('BRANCH ADMIN PERMISSION VERIFICATION')
console.log('='.repeat(60))

const branchAdminPerms = DEFAULT_ROLES.BRANCH_ADMIN.permissions

console.log(`\nTotal Branch Admin Permissions: ${branchAdminPerms.length}`)

// Categorize permissions
const categories = {}
branchAdminPerms.forEach(perm => {
  const category = perm.split('.')[0]
  categories[category] = (categories[category] || 0) + 1
})

console.log('\nPermissions by Category:')
console.log('-'.repeat(40))
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`  ${cat.padEnd(25)} : ${count}`)
  })

// Check for REMOVED permissions (should NOT be present)
const shouldBeRemoved = [
  { perm: 'SELL_CREATE', name: 'sell.create' },
  { perm: 'SELL_UPDATE', name: 'sell.update' },
  { perm: 'SELL_DELETE', name: 'sell.delete' },
  { perm: 'PURCHASE_CREATE', name: 'purchase.create' },
  { perm: 'PURCHASE_UPDATE', name: 'purchase.update' },
  { perm: 'PURCHASE_DELETE', name: 'purchase.delete' },
  { perm: 'STOCK_TRANSFER_CREATE', name: 'stock_transfer.create' },
  { perm: 'INVENTORY_CORRECTION_CREATE', name: 'inventory_correction.create' },
  { perm: 'EXPENSE_CREATE', name: 'expense.create' },
  { perm: 'PAYMENT_CREATE', name: 'payment.create' },
]

console.log('\n\nREMOVED Permission Verification:')
console.log('-'.repeat(40))
let removedCorrectly = 0
let stillPresent = 0

shouldBeRemoved.forEach(({ perm, name }) => {
  const has = branchAdminPerms.includes(PERMISSIONS[perm])
  if (has) {
    console.log(`  ❌ STILL PRESENT: ${name}`)
    stillPresent++
  } else {
    console.log(`  ✅ Removed: ${name}`)
    removedCorrectly++
  }
})

console.log(`\n  Summary: ${removedCorrectly} removed, ${stillPresent} still present`)

// Check for ADDED permissions (should be present)
const shouldBeAdded = [
  { perm: 'CUSTOMER_RETURN_VIEW', name: 'customer_return.view' },
  { perm: 'CUSTOMER_RETURN_APPROVE', name: 'customer_return.approve' },
  { perm: 'CUSTOMER_RETURN_DELETE', name: 'customer_return.delete' },
  { perm: 'SUPPLIER_RETURN_VIEW', name: 'supplier_return.view' },
  { perm: 'SUPPLIER_RETURN_APPROVE', name: 'supplier_return.approve' },
  { perm: 'SUPPLIER_RETURN_DELETE', name: 'supplier_return.delete' },
  { perm: 'VOID_CREATE', name: 'void.create' },
  { perm: 'VOID_APPROVE', name: 'void.approve' },
  { perm: 'CASH_APPROVE_LARGE_TRANSACTIONS', name: 'cash.approve_large_transactions' },
  { perm: 'SERIAL_NUMBER_VIEW', name: 'serial_number.view' },
  { perm: 'SERIAL_NUMBER_TRACK', name: 'serial_number.track' },
]

console.log('\n\nADDED Permission Verification:')
console.log('-'.repeat(40))
let addedCorrectly = 0
let missing = 0

shouldBeAdded.forEach(({ perm, name }) => {
  const has = branchAdminPerms.includes(PERMISSIONS[perm])
  if (has) {
    console.log(`  ✅ Added: ${name}`)
    addedCorrectly++
  } else {
    console.log(`  ❌ MISSING: ${name}`)
    missing++
  }
})

console.log(`\n  Summary: ${addedCorrectly} added, ${missing} missing`)

// Check for RETAINED permissions (should still be present)
const shouldBeRetained = [
  { perm: 'PURCHASE_APPROVE', name: 'purchase.approve' },
  { perm: 'PURCHASE_RECEIPT_APPROVE', name: 'purchase.receipt.approve' },
  { perm: 'INVENTORY_CORRECTION_APPROVE', name: 'inventory_correction.approve' },
  { perm: 'PRODUCT_CREATE', name: 'product.create' },
  { perm: 'USER_CREATE', name: 'user.create' },
  { perm: 'BUSINESS_SETTINGS_EDIT', name: 'business_settings.edit' },
]

console.log('\n\nRETAINED Permission Verification:')
console.log('-'.repeat(40))
let retainedCorrectly = 0
let retainedMissing = 0

shouldBeRetained.forEach(({ perm, name }) => {
  const has = branchAdminPerms.includes(PERMISSIONS[perm])
  if (has) {
    console.log(`  ✅ Retained: ${name}`)
    retainedCorrectly++
  } else {
    console.log(`  ❌ LOST: ${name}`)
    retainedMissing++
  }
})

console.log(`\n  Summary: ${retainedCorrectly} retained, ${retainedMissing} lost`)

// Final Summary
console.log('\n\n' + '='.repeat(60))
console.log('FINAL VERIFICATION SUMMARY')
console.log('='.repeat(60))

const allGood = stillPresent === 0 && missing === 0 && retainedMissing === 0

if (allGood) {
  console.log('✅ ALL CHECKS PASSED!')
  console.log('   Branch Admin role has been correctly updated.')
} else {
  console.log('❌ SOME CHECKS FAILED!')
  if (stillPresent > 0) {
    console.log(`   ${stillPresent} transactional permission(s) still present (should be removed)`)
  }
  if (missing > 0) {
    console.log(`   ${missing} supervisory permission(s) missing (should be added)`)
  }
  if (retainedMissing > 0) {
    console.log(`   ${retainedMissing} important permission(s) lost (should be retained)`)
  }
}

console.log('\n' + '='.repeat(60))
