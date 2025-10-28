/**
 * Verify that Warehouse Manager role now has all required permissions
 * for Pricing Management menus to appear
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function verifyFix() {
  console.log('\n✅ VERIFICATION: Warehouse Manager Pricing Menu Fix\n')
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
      },
      menuPermissions: {
        include: {
          menuPermission: true
        }
      }
    }
  })

  if (!warehouseRole) {
    console.log('❌ Warehouse Manager role not found')
    return
  }

  console.log(`✅ Role: ${warehouseRole.name} (ID: ${warehouseRole.id})\n`)

  // Check Menu Permissions
  console.log('📋 MENU PERMISSIONS (controls sidebar visibility):\n')
  const pricingMenus = warehouseRole.menuPermissions.filter(rmp =>
    ['pricing_management', 'bulk_price_editor', 'pricing_settings'].includes(rmp.menuPermission.key)
  )

  pricingMenus.forEach(rmp => {
    const m = rmp.menuPermission
    console.log(`   ✅ ${m.name} (${m.key})`)
  })

  // Check RBAC Permissions
  console.log('\n🔐 RBAC PERMISSIONS (required by Sidebar component):\n')

  const requiredRBACPermissions = [
    { name: 'product.price.edit', purpose: 'Pricing Management parent menu' },
    { name: 'product.price.bulk_edit', purpose: 'Bulk Price Editor child menu' },
    { name: 'pricing.settings.view', purpose: 'Pricing Settings child menu' }
  ]

  const hasAllPermissions = requiredRBACPermissions.every(({ name }) =>
    warehouseRole.permissions.some(rp => rp.permission.name === name)
  )

  requiredRBACPermissions.forEach(({ name, purpose }) => {
    const hasPermission = warehouseRole.permissions.some(rp => rp.permission.name === name)
    const emoji = hasPermission ? '✅' : '❌'
    console.log(`   ${emoji} ${name}`)
    console.log(`      → ${purpose}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 FINAL VERDICT:\n')

  if (pricingMenus.length === 3 && hasAllPermissions) {
    console.log('✅ SUCCESS! All requirements met:')
    console.log('   ✓ Menu permissions are saved (3/3)')
    console.log('   ✓ RBAC permissions are assigned (3/3)')
    console.log('\n🎉 The Sidebar should now show BOTH child menus:')
    console.log('   • Bulk Price Editor')
    console.log('   • Pricing Settings')
    console.log('\n📝 Next steps:')
    console.log('   1. Log out of the application')
    console.log('   2. Log back in as Warehouse Manager user')
    console.log('   3. Navigate to "Pricing Management" in the sidebar')
    console.log('   4. Verify both child menus are now visible\n')
  } else {
    console.log('❌ INCOMPLETE:')
    if (pricingMenus.length < 3) {
      console.log(`   • Menu permissions: ${pricingMenus.length}/3 (missing ${3 - pricingMenus.length})`)
    }
    if (!hasAllPermissions) {
      console.log('   • RBAC permissions: Missing some required permissions')
    }
    console.log('\n')
  }
}

verifyFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
