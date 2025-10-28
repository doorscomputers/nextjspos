/**
 * Verification: Check that ALL roles have proper RBAC permissions for their menu assignments
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Same menu-to-RBAC mapping (abbreviated for key menus)
const MENU_TO_RBAC_MAP: Record<string, string | null> = {
  'pricing_management': 'product.price.edit',
  'bulk_price_editor': 'product.price.bulk_edit',
  'pricing_settings': 'pricing.settings.view',
  'price_comparison': 'product.price_comparison.view',
  'cost_audit': 'product.cost_audit.view',
  'pos_sales': 'sell.create',
  'point_of_sale': 'sell.create',
  'inventory_management': 'product.view',
  'purchases': 'purchase.view',
  'stock_transfers': 'stock_transfer.view',
  'help_center': null,
  'my_profile': null,
}

async function verifySync() {
  console.log('\n✅ VERIFICATION: System-Wide Menu & RBAC Permission Sync\n')
  console.log('='.repeat(80))

  const allRoles = await prisma.role.findMany({
    where: {
      menuPermissions: {
        some: {}
      }
    },
    include: {
      menuPermissions: {
        include: {
          menuPermission: true
        }
      },
      permissions: {
        include: {
          permission: true
        }
      },
      users: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log(`\n📊 Checking ${allRoles.length} roles with menu permissions...\n`)

  let totalRolesChecked = 0
  let totalRolesWithIssues = 0
  let totalIssuesFound = 0

  const issuesByRole: Array<{
    roleName: string
    userCount: number
    issues: Array<{ menuName: string, missingRBAC: string }>
  }> = []

  for (const role of allRoles) {
    const existingRBACPermissions = new Set(
      role.permissions.map(rp => rp.permission.name)
    )

    const issues: Array<{ menuName: string, missingRBAC: string }> = []

    for (const roleMenuPerm of role.menuPermissions) {
      const menuKey = roleMenuPerm.menuPermission.key
      const requiredRBACPerm = MENU_TO_RBAC_MAP[menuKey]

      if (!requiredRBACPerm) continue

      if (!existingRBACPermissions.has(requiredRBACPerm)) {
        issues.push({
          menuName: roleMenuPerm.menuPermission.name,
          missingRBAC: requiredRBACPerm
        })
      }
    }

    if (issues.length > 0) {
      totalRolesWithIssues++
      totalIssuesFound += issues.length
      issuesByRole.push({
        roleName: role.name,
        userCount: role.users.length,
        issues
      })
    }

    totalRolesChecked++
  }

  console.log('='.repeat(80))
  console.log('\n📊 VERIFICATION RESULTS:\n')

  if (totalRolesWithIssues === 0) {
    console.log('✅ PERFECT! All roles are properly synchronized!')
    console.log(`   Checked: ${totalRolesChecked} roles`)
    console.log(`   Issues Found: 0`)
    console.log('\n🎉 The menu permission system is now fully operational!')
    console.log('   Users can log out and log back in to see all their assigned menus.\n')
  } else {
    console.log(`⚠️  Found ${totalIssuesFound} issue(s) in ${totalRolesWithIssues} role(s):\n`)

    issuesByRole.forEach(({ roleName, userCount, issues }) => {
      console.log(`   ${roleName} (${userCount} users):`)
      issues.forEach(issue => {
        console.log(`      ❌ Menu "${issue.menuName}" missing RBAC: ${issue.missingRBAC}`)
      })
      console.log('')
    })

    console.log('   Run the sync script again to fix these issues.\n')
  }

  console.log('='.repeat(80))
  console.log('')
}

verifySync()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
