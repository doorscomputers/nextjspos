#!/usr/bin/env node

/**
 * Create Specialized Approval Roles for UltimatePOS Modern
 *
 * This script creates the following approval-focused roles:
 * 1. Transfer Approver - Approves/rejects inventory transfers between locations
 * 2. GRN Approver - Approves/rejects Goods Received Notes (purchase receipts)
 * 3. Inventory Correction Approver - Approves/rejects inventory corrections
 * 4. Return Approver - Approves/rejects customer and supplier returns
 *
 * Usage: node scripts/create-approval-roles.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Define approval role configurations
const APPROVAL_ROLES = {
  TRANSFER_APPROVER: {
    name: 'Transfer Approver',
    description: 'Can view and approve/reject inventory transfers between locations',
    permissions: [
      'dashboard.view',
      'stock_transfer.view',
      'stock_transfer.check',
      'stock_transfer.send',
      'stock_transfer.receive',
      'stock_transfer.verify',
      'stock_transfer.complete',
      'stock_transfer.cancel',
      'location.view',
      'product.view',
      'report.transfer.view',
      'report.transfer.trends',
      'audit_log.view',
    ]
  },

  GRN_APPROVER: {
    name: 'GRN Approver',
    description: 'Can view and approve/reject Goods Received Notes (purchase receipts)',
    permissions: [
      'dashboard.view',
      'purchase.receipt.view',
      'purchase.receipt.approve',
      'purchase.view',
      'product.view',
      'supplier.view',
      'serial_number.view',
      'serial_number.track',
      'location.view',
      'report.purchase.view',
      'audit_log.view',
    ]
  },

  INVENTORY_CORRECTION_APPROVER: {
    name: 'Inventory Correction Approver',
    description: 'Can view and approve/reject inventory corrections and adjustments',
    permissions: [
      'dashboard.view',
      'inventory_correction.view',
      'inventory_correction.approve',
      'product.view',
      'location.view',
      'inventory_ledger.view',
      'report.stock.view',
      'report.stock_alert',
      'view_inventory_reports',
      'audit_log.view',
    ]
  },

  RETURN_APPROVER: {
    name: 'Return Approver',
    description: 'Can view and approve/reject customer returns and supplier returns',
    permissions: [
      'dashboard.view',
      'customer_return.view',
      'customer_return.approve',
      'supplier_return.view',
      'supplier_return.approve',
      'product.view',
      'customer.view',
      'supplier.view',
      'location.view',
      'serial_number.view',
      'audit_log.view',
    ]
  },

  PURCHASE_APPROVER: {
    name: 'Purchase Approver',
    description: 'Can view and approve/reject purchase orders',
    permissions: [
      'dashboard.view',
      'purchase.view',
      'purchase.approve',
      'product.view',
      'supplier.view',
      'location.view',
      'report.purchase.view',
      'audit_log.view',
    ]
  },

  QC_INSPECTOR: {
    name: 'QC Inspector',
    description: 'Can conduct and approve quality control inspections',
    permissions: [
      'dashboard.view',
      'qc_inspection.view',
      'qc_inspection.conduct',
      'qc_inspection.approve',
      'qc_template.view',
      'product.view',
      'purchase.receipt.view',
      'supplier.view',
      'audit_log.view',
    ]
  }
}

async function main() {
  console.log('🚀 Creating Approval Roles for UltimatePOS Modern\n')

  // Get all businesses to create roles for each
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true }
  })

  if (businesses.length === 0) {
    console.log('❌ No businesses found. Please seed the database first.')
    return
  }

  console.log(`📊 Found ${businesses.length} business(es):\n`)

  for (const business of businesses) {
    console.log(`\n🏢 Creating approval roles for business: ${business.name} (ID: ${business.id})`)
    console.log('─'.repeat(60))

    for (const [key, config] of Object.entries(APPROVAL_ROLES)) {
      try {
        // Check if role already exists
        const existingRole = await prisma.role.findFirst({
          where: {
            name: config.name,
            businessId: business.id
          }
        })

        if (existingRole) {
          console.log(`⚠️  Role "${config.name}" already exists - skipping`)
          continue
        }

        // Create the role
        const role = await prisma.role.create({
          data: {
            name: config.name,
            businessId: business.id,
            isDefault: false,
            guardName: 'web'
          }
        })

        console.log(`✅ Created role: ${config.name}`)
        console.log(`   Description: ${config.description}`)

        // Assign permissions to the role
        let assignedCount = 0
        let skippedCount = 0

        for (const permissionName of config.permissions) {
          // Find the permission by name
          const permission = await prisma.permission.findUnique({
            where: { name: permissionName }
          })

          if (!permission) {
            console.log(`   ⚠️  Permission "${permissionName}" not found - skipping`)
            skippedCount++
            continue
          }

          // Assign permission to role
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id
            }
          })

          assignedCount++
        }

        console.log(`   📝 Assigned ${assignedCount} permissions`)
        if (skippedCount > 0) {
          console.log(`   ⚠️  Skipped ${skippedCount} permissions (not found in database)`)
        }

      } catch (error) {
        console.error(`❌ Error creating role "${config.name}":`, error.message)
      }
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('✨ Approval roles creation complete!\n')

  // Show summary
  console.log('📋 CREATED ROLES SUMMARY:')
  console.log('─'.repeat(60))

  for (const [key, config] of Object.entries(APPROVAL_ROLES)) {
    console.log(`\n${config.name}`)
    console.log(`  Purpose: ${config.description}`)
    console.log(`  Permissions: ${config.permissions.length}`)
  }

  console.log('\n' + '═'.repeat(60))
  console.log('\n📚 HOW TO ASSIGN THESE ROLES TO USERS:\n')
  console.log('1. Via Prisma (Programmatically):')
  console.log('   ```javascript')
  console.log('   await prisma.userRole.create({')
  console.log('     data: {')
  console.log('       userId: <user_id>,')
  console.log('       roleId: <role_id>')
  console.log('     }')
  console.log('   })')
  console.log('   ```\n')

  console.log('2. Via SQL:')
  console.log('   ```sql')
  console.log('   INSERT INTO user_roles (user_id, role_id)')
  console.log('   VALUES (<user_id>, <role_id>);')
  console.log('   ```\n')

  console.log('3. Via UI:')
  console.log('   - Navigate to Dashboard > Users')
  console.log('   - Edit a user')
  console.log('   - Assign the desired approval role(s)')
  console.log('   - Save changes\n')

  console.log('💡 TIPS:')
  console.log('─'.repeat(60))
  console.log('• Users can have multiple roles (e.g., Cashier + Transfer Approver)')
  console.log('• Approval roles are location-aware (assign users to specific locations)')
  console.log('• Use RoleLocation table to restrict roles to specific locations')
  console.log('• All approval roles have view-only access to related data')
  console.log('• Approval roles do NOT have create/edit/delete permissions\n')

  console.log('🔧 LOCATION-BASED ACCESS:')
  console.log('─'.repeat(60))
  console.log('To restrict a role to specific locations:')
  console.log('```javascript')
  console.log('await prisma.roleLocation.create({')
  console.log('  data: {')
  console.log('    roleId: <role_id>,')
  console.log('    locationId: <location_id>')
  console.log('  }')
  console.log('})')
  console.log('```\n')
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
