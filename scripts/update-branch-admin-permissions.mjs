/**
 * Update Branch Admin Permissions
 *
 * This script updates existing Branch Admin roles to follow the supervisory principle:
 * - REMOVES: Transactional CREATE/UPDATE/DELETE permissions
 * - ADDS: Missing supervisory/approval permissions
 * - RETAINS: All VIEW, APPROVE, and master data management permissions
 *
 * Usage: node scripts/update-branch-admin-permissions.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Permissions to REMOVE (transactional operations)
const PERMISSIONS_TO_REMOVE = [
  // Sales/POS Operations
  'sell.create',
  'sell.update',
  'sell.delete',

  // Purchase Operations
  'purchase.create',
  'purchase.update',
  'purchase.delete',

  // GRN/Receipt Operations
  'purchase.receipt.create',

  // Purchase Returns
  'purchase_return.create',
  'purchase_return.update',
  'purchase_return.delete',

  // Purchase Amendments
  'purchase_amendment.create',

  // QC Inspections
  'qc_inspection.create',

  // Inventory Corrections
  'inventory_correction.create',
  'inventory_correction.update',
  'inventory_correction.delete',

  // Stock Transfers
  'stock_transfer.create',

  // Expenses
  'expense.create',
  'expense.update',
  'expense.delete',

  // Accounts Payable
  'accounts_payable.create',
  'accounts_payable.update',
  'accounts_payable.delete',

  // Payments
  'payment.create',
  'payment.update',
  'payment.delete',

  // Banking
  'bank.create',
  'bank.update',
  'bank.delete',
  'bank_transaction.create',
  'bank_transaction.update',
  'bank_transaction.delete',
]

// Permissions to ADD (supervisory functions)
const PERMISSIONS_TO_ADD = [
  // Customer Returns
  'customer_return.view',
  'customer_return.approve',
  'customer_return.delete',

  // Supplier Returns
  'supplier_return.view',
  'supplier_return.approve',
  'supplier_return.delete',

  // Void Transactions
  'void.create',
  'void.approve',

  // Cash Management
  'cash.approve_large_transactions',

  // Serial Numbers
  'serial_number.view',
  'serial_number.track',

  // Shift Management
  'shift.view',
  'shift.view_all',

  // BIR Readings
  'reading.x_reading',
  'reading.z_reading',

  // Product Stock Management (might be missing)
  'product.modify_locked_stock',
]

async function updateBranchAdminPermissions() {
  console.log('🚀 Starting Branch Admin Permission Update...\n')

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
      },
    })

    console.log(`📊 Found ${businesses.length} business(es) in the database\n`)

    let updatedCount = 0
    let notFoundCount = 0

    for (const business of businesses) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`Processing: ${business.name} (ID: ${business.id})`)
      console.log('='.repeat(60))

      // Find Branch Admin role for this business
      const branchAdminRole = await prisma.role.findFirst({
        where: {
          name: 'Branch Admin',
          businessId: business.id,
        },
        include: {
          _count: {
            select: { users: true },
          },
        },
      })

      if (!branchAdminRole) {
        console.log(`⚠️  No Branch Admin role found for business: ${business.name}`)
        notFoundCount++
        continue
      }

      console.log(`✅ Found Branch Admin role (ID: ${branchAdminRole.id})`)
      console.log(`   Assigned to ${branchAdminRole._count.users} user(s)`)

      // STEP 1: Remove obsolete permissions
      console.log(`\n📥 Removing transactional permissions...`)
      let removedCount = 0

      for (const permName of PERMISSIONS_TO_REMOVE) {
        const permission = await prisma.permission.findUnique({
          where: { name: permName },
        })

        if (permission) {
          const deleted = await prisma.rolePermission.deleteMany({
            where: {
              roleId: branchAdminRole.id,
              permissionId: permission.id,
            },
          })

          if (deleted.count > 0) {
            console.log(`   ✅ Removed: ${permName}`)
            removedCount++
          }
        }
      }

      console.log(`   📊 Total removed: ${removedCount} permissions`)

      // STEP 2: Add new supervisory permissions
      console.log(`\n📤 Adding supervisory permissions...`)
      let addedCount = 0

      for (const permName of PERMISSIONS_TO_ADD) {
        const permission = await prisma.permission.findUnique({
          where: { name: permName },
        })

        if (permission) {
          const existing = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: branchAdminRole.id,
                permissionId: permission.id,
              },
            },
          })

          if (!existing) {
            await prisma.rolePermission.create({
              data: {
                roleId: branchAdminRole.id,
                permissionId: permission.id,
              },
            })
            console.log(`   ✅ Added: ${permName}`)
            addedCount++
          }
        } else {
          console.log(`   ⚠️  Permission not found in database: ${permName}`)
        }
      }

      console.log(`   📊 Total added: ${addedCount} permissions`)

      // STEP 3: Count final permissions
      const finalPermissionCount = await prisma.rolePermission.count({
        where: { roleId: branchAdminRole.id },
      })

      console.log(`\n✅ Update complete for ${business.name}`)
      console.log(`   Final permission count: ${finalPermissionCount}`)

      updatedCount++
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Businesses processed: ${businesses.length}`)
    console.log(`✅ Branch Admin roles updated: ${updatedCount}`)
    if (notFoundCount > 0) {
      console.log(`⚠️  Businesses without Branch Admin role: ${notFoundCount}`)
    }
    console.log(`\n✅ All Branch Admin roles have been updated successfully!`)

    console.log(`\n${'='.repeat(60)}`)
    console.log('NEXT STEPS')
    console.log('='.repeat(60))
    console.log(`1. Ask all Branch Admin users to LOGOUT and LOGIN again`)
    console.log(`2. Verify permissions in the UI`)
    console.log(`3. Test approval workflows`)
    console.log(`4. Review audit logs`)
    console.log(`\n📄 Full report: BRANCH_ADMIN_RECONFIGURATION_REPORT.md`)

  } catch (error) {
    console.error('\n❌ Error updating Branch Admin permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateBranchAdminPermissions()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
