/**
 * Clear Menu Permissions for Non-Super Admin Roles
 *
 * This script removes ALL menu permissions from roles except Super Admin.
 * After running this, you must manually configure menu permissions for each role
 * via Settings > Menu Permissions in the dashboard.
 *
 * Run with: npx tsx scripts/clear-non-superadmin-menu-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Starting cleanup of non-Super Admin menu permissions...')

  // Get all businesses
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true }
  })

  console.log(`Found ${businesses.length} business(es)`)

  let totalDeleted = 0

  for (const business of businesses) {
    console.log(`\n📦 Processing business: ${business.name} (ID: ${business.id})`)

    // Get all roles EXCEPT Super Admin
    const nonSuperAdminRoles = await prisma.role.findMany({
      where: {
        businessId: business.id,
        name: { not: 'Super Admin' }
      },
      select: { id: true, name: true }
    })

    console.log(`  Found ${nonSuperAdminRoles.length} non-Super Admin role(s)`)

    for (const role of nonSuperAdminRoles) {
      console.log(`  🔧 Processing role: ${role.name}`)

      // Delete all menu permissions for this role
      const deleted = await prisma.roleMenuPermission.deleteMany({
        where: { roleId: role.id }
      })

      console.log(`    ✅ Removed ${deleted.count} menu permission(s)`)
      totalDeleted += deleted.count
    }
  }

  console.log('\n🎉 Cleanup completed successfully!')
  console.log('\n📝 Summary:')
  console.log(`  - Total menu permissions removed: ${totalDeleted}`)
  console.log(`  - Super Admin menu permissions: UNCHANGED`)
  console.log(`  - All other roles now have 0 menus`)
  console.log('\n⚠️  IMPORTANT: You must now configure menu permissions for each role via:')
  console.log('    Settings > Menu Permissions > [Select Role] > Enable/Disable menus')
}

main()
  .catch((e) => {
    console.error('❌ Error clearing menu permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
