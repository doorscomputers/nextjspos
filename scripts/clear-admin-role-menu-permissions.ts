/**
 * Clear Menu Permissions for Admin Roles ONLY
 *
 * This script removes menu permissions ONLY from these roles:
 * - Admin
 * - All Branch Admin
 * - System Administrator
 *
 * All other roles (Sales Cashier, Warehouse Manager, Transfer Manager,
 * Price Manager, Cross Location Approver, etc.) are LEFT UNTOUCHED.
 *
 * Super Admin is also left untouched.
 *
 * Run with: npx tsx scripts/clear-admin-role-menu-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ONLY these roles will have their menu permissions cleared
const ADMIN_ROLES_TO_CLEAR = [
  'Admin',
  'All Branch Admin',
  'System Administrator'
]

async function main() {
  console.log('🧹 Starting cleanup of admin role menu permissions...')
  console.log(`\n⚠️  Only clearing menu permissions for: ${ADMIN_ROLES_TO_CLEAR.join(', ')}`)
  console.log('✅ All other roles will remain untouched\n')

  // Get all businesses
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true }
  })

  console.log(`Found ${businesses.length} business(es)`)

  let totalDeleted = 0
  const affectedRoles: string[] = []

  for (const business of businesses) {
    console.log(`\n📦 Processing business: ${business.name} (ID: ${business.id})`)

    // Get ONLY the admin roles we want to clear
    const adminRolesToClear = await prisma.role.findMany({
      where: {
        businessId: business.id,
        name: { in: ADMIN_ROLES_TO_CLEAR }
      },
      select: { id: true, name: true }
    })

    console.log(`  Found ${adminRolesToClear.length} admin role(s) to clear`)

    for (const role of adminRolesToClear) {
      console.log(`  🔧 Clearing role: ${role.name}`)

      // Count existing menu permissions before deletion
      const existingCount = await prisma.roleMenuPermission.count({
        where: { roleId: role.id }
      })

      // Delete all menu permissions for this role
      const deleted = await prisma.roleMenuPermission.deleteMany({
        where: { roleId: role.id }
      })

      console.log(`    ✅ Removed ${deleted.count} menu permission(s) (had ${existingCount})`)
      totalDeleted += deleted.count
      affectedRoles.push(role.name)
    }

    // Show which roles were NOT touched
    const untouchedRoles = await prisma.role.findMany({
      where: {
        businessId: business.id,
        name: { notIn: [...ADMIN_ROLES_TO_CLEAR, 'Super Admin'] }
      },
      select: { name: true }
    })

    if (untouchedRoles.length > 0) {
      console.log(`\n  ✅ UNTOUCHED roles (menu permissions preserved):`)
      untouchedRoles.forEach(role => {
        console.log(`     - ${role.name}`)
      })
    }
  }

  console.log('\n🎉 Cleanup completed successfully!')
  console.log('\n📝 Summary:')
  console.log(`  - Total menu permissions removed: ${totalDeleted}`)
  console.log(`  - Roles cleared: ${ADMIN_ROLES_TO_CLEAR.join(', ')}`)
  console.log(`  - Super Admin: UNCHANGED (still has all menus)`)
  console.log(`  - Other roles (Cashier, Warehouse Manager, etc.): UNCHANGED`)
  console.log('\n⚠️  NEXT STEPS:')
  console.log('    1. Go to Settings > Menu Permissions')
  console.log('    2. Configure menus for: ' + ADMIN_ROLES_TO_CLEAR.join(', '))
  console.log('    3. Save your changes')
  console.log('    4. Test with users assigned to these roles')
}

main()
  .catch((e) => {
    console.error('❌ Error clearing menu permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
