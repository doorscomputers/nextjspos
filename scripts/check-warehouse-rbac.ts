/**
 * Check RBAC permissions for Warehouse Manager role
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkWarehouseRBAC() {
  console.log('\n🔍 CHECKING RBAC PERMISSIONS FOR WAREHOUSE MANAGER\n')
  console.log('='.repeat(80))

  // Find Warehouse Manager role
  const warehouseRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'Warehouse', mode: 'insensitive' }
    },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  if (!warehouseRole) {
    console.log('❌ Warehouse Manager role not found')
    return
  }

  console.log(`✅ Found Role: ${warehouseRole.name} (ID: ${warehouseRole.id})`)
  console.log(`   Total RBAC Permissions: ${warehouseRole.permissions.length}`)

  // Check for pricing-related RBAC permissions
  const pricingPermissionKeys = [
    'PRODUCT_PRICE_BULK_EDIT',
    'PRODUCT_PRICE_EDIT',
    'PRICING_SETTINGS_VIEW',
    'PRODUCT_VIEW',
    'PRODUCT_EDIT'
  ]

  console.log(`\n📋 Checking for Pricing-Related RBAC Permissions:\n`)

  const missingPermissions: string[] = []

  for (const permKey of pricingPermissionKeys) {
    const hasPermission = warehouseRole.permissions.some(
      rp => rp.permission.key === permKey
    )

    const emoji = hasPermission ? '✅' : '❌'
    console.log(`   ${emoji} ${permKey}: ${hasPermission ? 'ASSIGNED' : 'MISSING'}`)

    if (!hasPermission) {
      missingPermissions.push(permKey)
    }
  }

  // Show all assigned permissions
  console.log(`\n📊 All Assigned RBAC Permissions (${warehouseRole.permissions.length} total):\n`)
  warehouseRole.permissions
    .sort((a, b) => a.permission.key.localeCompare(b.permission.key))
    .forEach(rp => {
      console.log(`   • ${rp.permission.key}`)
    })

  console.log('\n' + '='.repeat(80))

  if (missingPermissions.length > 0) {
    console.log(`\n⚠️  PROBLEM IDENTIFIED:\n`)
    console.log(`   Warehouse Manager role is MISSING ${missingPermissions.length} RBAC permission(s):`)
    missingPermissions.forEach(p => console.log(`      - ${p}`))
    console.log(`\n💡 SOLUTION:`)
    console.log(`   Run: npx tsx scripts/fix-warehouse-rbac.ts`)
    console.log(`   This will add the missing RBAC permissions to Warehouse Manager role.\n`)
  } else {
    console.log(`\n✅ All pricing-related RBAC permissions are assigned!\n`)
  }

  console.log('')
}

checkWarehouseRBAC()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
