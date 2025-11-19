import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnose() {
  console.log('\n🔍 DIAGNOSING PERMISSION TABLES\n')
  console.log('=' .repeat(60))

  try {
    // Check user_roles
    const userRolesCount = await prisma.userRole.count()
    const superadminRoles = await prisma.userRole.findMany({
      where: {
        user: { username: 'superadmin' }
      },
      include: {
        role: { select: { name: true } },
        user: { select: { username: true } }
      }
    })
    console.log(`\n📊 USER_ROLES TABLE:`)
    console.log(`   Total records: ${userRolesCount}`)
    console.log(`   Superadmin roles: ${superadminRoles.length}`)
    if (superadminRoles.length > 0) {
      superadminRoles.forEach(ur => {
        console.log(`   - ${ur.user.username} → ${ur.role.name}`)
      })
    } else {
      console.log(`   ⚠️  WARNING: Superadmin has NO roles assigned!`)
    }

    // Check role_permissions
    const rolePermissionsCount = await prisma.rolePermission.count()
    console.log(`\n📊 ROLE_PERMISSIONS TABLE:`)
    console.log(`   Total records: ${rolePermissionsCount}`)
    if (rolePermissionsCount === 0) {
      console.log(`   ❌ CRITICAL: Table is EMPTY!`)
    }

    // Check role_menu_permissions
    const roleMenuPermissionsCount = await prisma.roleMenuPermission.count()
    console.log(`\n📊 ROLE_MENU_PERMISSIONS TABLE:`)
    console.log(`   Total records: ${roleMenuPermissionsCount}`)
    if (roleMenuPermissionsCount === 0) {
      console.log(`   ❌ CRITICAL: Table is EMPTY!`)
    } else {
      // Check specific roles
      const allBranchAdminMenus = await prisma.roleMenuPermission.count({
        where: { role: { name: 'All Branch Admin' } }
      })
      const salesCashierMenus = await prisma.roleMenuPermission.count({
        where: { role: { name: 'Sales Cashier' } }
      })
      console.log(`   - All Branch Admin: ${allBranchAdminMenus} menus`)
      console.log(`   - Sales Cashier: ${salesCashierMenus} menus`)
    }

    // Check user_permissions
    const userPermissionsCount = await prisma.userPermission.count()
    console.log(`\n📊 USER_PERMISSIONS TABLE:`)
    console.log(`   Total records: ${userPermissionsCount}`)

    // Check user_menu_permissions
    const userMenuPermissionsCount = await prisma.userMenuPermission.count()
    console.log(`\n📊 USER_MENU_PERMISSIONS TABLE:`)
    console.log(`   Total records: ${userMenuPermissionsCount}`)

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('\n📋 DIAGNOSIS SUMMARY:\n')

    const issues = []
    if (userRolesCount === 0) issues.push('❌ user_roles is EMPTY')
    if (rolePermissionsCount === 0) issues.push('❌ role_permissions is EMPTY')
    if (roleMenuPermissionsCount === 0) issues.push('❌ role_menu_permissions is EMPTY')
    if (superadminRoles.length === 0) issues.push('❌ superadmin has NO roles assigned')

    if (issues.length > 0) {
      console.log('🚨 CRITICAL ISSUES FOUND:\n')
      issues.forEach(issue => console.log(`   ${issue}`))
      console.log('\n💡 RECOMMENDATION:')
      console.log('   The reset_transactions.sql script appears to have been run.')
      console.log('   You need to restore from backup or re-seed the database.')
      console.log('\n   Run one of these:')
      console.log('   1. npm run db:seed (restore default data)')
      console.log('   2. tsx scripts/restore-menu-permissions.ts (restore menu permissions backup)')
    } else {
      console.log('✅ All tables have data - no critical issues detected')
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnose()
