/**
 * Add missing RBAC permissions to Warehouse Manager role
 *
 * This fixes the issue where Pricing Management child menus are checked
 * in menu permissions but don't appear in the sidebar due to missing RBAC permissions.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function fixWarehouseRBAC() {
  console.log('\n🔧 ADDING MISSING RBAC PERMISSIONS TO WAREHOUSE MANAGER\n')
  console.log('='.repeat(80))

  // Find Warehouse Manager role
  const warehouseRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'Warehouse', mode: 'insensitive' }
    }
  })

  if (!warehouseRole) {
    console.log('❌ Warehouse Manager role not found')
    return
  }

  console.log(`✅ Found Role: ${warehouseRole.name} (ID: ${warehouseRole.id})`)

  // Required RBAC permissions for pricing functionality
  const requiredPermissions = [
    'product.price.bulk_edit',  // For Bulk Price Editor menu
    'product.price.edit',       // For Pricing Management parent and general price editing
    'pricing.settings.view',    // For Pricing Settings menu
    'product.view',             // Base product viewing
    'product.update'            // Base product editing
  ]

  console.log(`\n📋 Adding ${requiredPermissions.length} RBAC permissions...\n`)

  let addedCount = 0
  let skippedCount = 0

  for (const permKey of requiredPermissions) {
    // Find the permission in database
    const permission = await prisma.permission.findFirst({
      where: { name: permKey }
    })

    if (!permission) {
      console.log(`   ⚠️  ${permKey} - permission not found in database, skipping`)
      continue
    }

    // Check if already assigned
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: warehouseRole.id,
          permissionId: permission.id
        }
      }
    })

    if (existing) {
      console.log(`   ✓ ${permKey} - already assigned`)
      skippedCount++
    } else {
      await prisma.rolePermission.create({
        data: {
          roleId: warehouseRole.id,
          permissionId: permission.id
        }
      })
      console.log(`   ✅ ${permKey} - ADDED`)
      addedCount++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n✨ Summary:`)
  console.log(`   ✅ Added: ${addedCount} permission(s)`)
  console.log(`   ✓ Already had: ${skippedCount} permission(s)`)

  if (addedCount > 0) {
    console.log(`\n📝 Next Steps:`)
    console.log(`   1. Log out of the application`)
    console.log(`   2. Log back in as a Warehouse Manager user`)
    console.log(`   3. Both "Bulk Price Editor" and "Pricing Settings" should now appear`)
    console.log(`      under "Pricing Management" in the sidebar`)
  }

  console.log('\n')
}

fixWarehouseRBAC()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
