/**
 * Migration Script: Add Granular Permissions for Product Master Data and Reports
 *
 * This script adds new fine-grained permissions for:
 * 1. Product Master Data (Categories, Brands, Units, Warranties)
 * 2. Report Types (Sales, Purchase, Transfer, Financial)
 *
 * Run this script AFTER updating the rbac.ts file
 *
 * Usage: node scripts/add-granular-permissions.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// New permissions to add (Permission model only has: name, guardName)
const NEW_PERMISSIONS = [
  // Product Master Data Permissions
  'product.category.view',
  'product.category.create',
  'product.category.update',
  'product.category.delete',

  'product.brand.view',
  'product.brand.create',
  'product.brand.update',
  'product.brand.delete',

  'product.unit.view',
  'product.unit.create',
  'product.unit.update',
  'product.unit.delete',

  'product.warranty.view',
  'product.warranty.create',
  'product.warranty.update',
  'product.warranty.delete',

  // Sales Report Permissions
  'report.sales.view',
  'report.sales.daily',
  'report.sales.profitability',

  // Purchase Report Permissions
  'report.purchase.view',
  'report.purchase.analytics',
  'report.purchase.trends',
  'report.purchase.items',

  // Transfer Report Permissions
  'report.transfer.view',
  'report.transfer.trends',

  // Financial Report Permissions
  'report.profitability',
  'report.product_purchase_history',

  // Stock Report Permissions
  'report.stock_alert',
]

// Role-specific permission assignments
const ROLE_PERMISSIONS = {
  'Super Admin': 'ALL', // Gets all permissions automatically

  'Branch Admin': [
    // Product Master Data - Full Access
    'product.category.view', 'product.category.create', 'product.category.update', 'product.category.delete',
    'product.brand.view', 'product.brand.create', 'product.brand.update', 'product.brand.delete',
    'product.unit.view', 'product.unit.create', 'product.unit.update', 'product.unit.delete',
    'product.warranty.view', 'product.warranty.create', 'product.warranty.update', 'product.warranty.delete',
    // All Reports
    'report.sales.view', 'report.sales.daily', 'report.sales.profitability',
    'report.purchase.view', 'report.purchase.analytics', 'report.purchase.trends', 'report.purchase.items',
    'report.transfer.view', 'report.transfer.trends',
    'report.profitability', 'report.product_purchase_history', 'report.stock_alert',
  ],

  'Branch Manager': [
    // Product Master Data - View Only
    'product.category.view', 'product.brand.view', 'product.unit.view', 'product.warranty.view',
    // Sales, Stock, and Transfer Reports Only
    'report.sales.view', 'report.sales.daily',
    'report.transfer.view', 'report.transfer.trends',
    'report.stock_alert',
  ],

  'Accounting Staff': [
    // NO Product Master Data access
    // Purchase and Financial Reports Only
    'report.purchase.view', 'report.purchase.analytics', 'report.purchase.trends', 'report.purchase.items',
    'report.profitability', 'report.product_purchase_history',
  ],

  'Regular Staff': [
    // NO Product Master Data access
    // Sales Reports Only
    'report.sales.view', 'report.stock_alert',
  ],

  'Regular Cashier': [
    // NO Product Master Data access
    // NO Report access
  ],
}

async function main() {
  console.log('🚀 Starting granular permissions migration...\n')

  try {
    // Step 1: Add new permissions to database
    console.log('📝 Adding new permissions to database...')
    let permissionsAdded = 0
    let permissionsSkipped = 0

    for (const permName of NEW_PERMISSIONS) {
      const existing = await prisma.permission.findUnique({
        where: { name: permName }
      })

      if (!existing) {
        await prisma.permission.create({
          data: {
            name: permName,
            guardName: 'web'
          }
        })
        console.log(`   ✅ Added: ${permName}`)
        permissionsAdded++
      } else {
        console.log(`   ⏭️  Skipped (exists): ${permName}`)
        permissionsSkipped++
      }
    }

    console.log(`\n✅ Permissions added: ${permissionsAdded}`)
    console.log(`⏭️  Permissions skipped: ${permissionsSkipped}\n`)

    // Step 2: Assign permissions to roles
    console.log('🔐 Assigning permissions to roles...\n')

    for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
      if (permissionNames === 'ALL') {
        console.log(`   🌟 ${roleName}: Gets all permissions automatically (Super Admin)`)
        continue
      }

      // Find all roles with this name across all businesses
      const roles = await prisma.role.findMany({
        where: { name: roleName },
        include: { permissions: true }
      })

      console.log(`   👥 Found ${roles.length} role(s) named "${roleName}"`)

      for (const role of roles) {
        let assignedCount = 0

        for (const permName of permissionNames) {
          const permission = await prisma.permission.findUnique({
            where: { name: permName }
          })

          if (!permission) {
            console.log(`      ⚠️  Permission not found: ${permName}`)
            continue
          }

          // Check if role already has this permission
          const existingAssignment = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id
              }
            }
          })

          if (!existingAssignment) {
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id
              }
            })
            assignedCount++
          }
        }

        console.log(`      ✅ Assigned ${assignedCount} new permissions to role ID ${role.id}`)
      }
    }

    console.log('\n✅ All permissions assigned successfully!\n')

    // Step 3: Summary
    console.log('📊 MIGRATION SUMMARY')
    console.log('═══════════════════════════════════════════════════')
    console.log(`✅ Total new permissions added: ${permissionsAdded}`)
    console.log(`⏭️  Permissions already existed: ${permissionsSkipped}`)
    console.log(`🔐 Roles updated with new permissions\n`)

    console.log('📋 PERMISSION BREAKDOWN BY ROLE:')
    console.log('═══════════════════════════════════════════════════')
    console.log('👑 Super Admin: All permissions (automatic)')
    console.log('🏢 Branch Admin: Full product master data + All reports')
    console.log('📊 Branch Manager: View-only product master data + Sales/Transfer reports')
    console.log('💰 Accounting Staff: Purchase & Financial reports only')
    console.log('👤 Regular Staff: Sales reports only')
    console.log('💵 Regular Cashier: NO product master data or reports\n')

    console.log('✅ MIGRATION COMPLETE!\n')
    console.log('🎯 Next Steps:')
    console.log('   1. Test the sidebar menu visibility with different roles')
    console.log('   2. Verify cashiers cannot access Categories/Brands/Units/Warranties')
    console.log('   3. Verify report access is properly restricted')
    console.log('   4. Check that existing users maintain their access levels\n')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
