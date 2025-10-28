/**
 * Diagnose and Fix Pricing Management Menu Issue
 *
 * This script checks why child menus (Bulk Price Editor, Pricing Settings)
 * are checked in the UI but not appearing in the sidebar.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnosePricingMenuIssue() {
  console.log('\n🔍 DIAGNOSING PRICING MENU ISSUE')
  console.log('='.repeat(80))

  // Find Warehouse Manager role
  const warehouseManagerRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'Warehouse', mode: 'insensitive' }
    },
    include: {
      menuPermissions: {
        include: {
          menuPermission: true
        }
      },
      users: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  })

  if (!warehouseManagerRole) {
    console.log('❌ Warehouse Manager role not found')
    return
  }

  console.log(`\n✅ Found Role: "${warehouseManagerRole.name}" (ID: ${warehouseManagerRole.id})`)
  console.log(`   Users with this role: ${warehouseManagerRole.users.length}`)
  warehouseManagerRole.users.forEach(ur => {
    console.log(`      - ${ur.user.username} (${ur.user.firstName} ${ur.user.lastName})`)
  })

  // Get pricing-related menus
  const pricingMenus = await prisma.menuPermission.findMany({
    where: {
      OR: [
        { key: 'pricing_management' },
        { key: 'bulk_price_editor' },
        { key: 'pricing_settings' },
        { key: 'price_comparison' },
        { key: 'cost_audit' }
      ]
    }
  })

  console.log(`\n📋 Pricing-Related Menus in Database:`)
  pricingMenus.forEach(m => {
    console.log(`   - ${m.name} (key: ${m.key}, ID: ${m.id}, parentId: ${m.parentId})`)
  })

  // Check which pricing menus are assigned to Warehouse Manager role
  console.log(`\n🔍 Checking Warehouse Manager Role's Menu Assignments:`)
  const pricingMenuKeys = pricingMenus.map(m => m.key)
  const assignedPricingMenus = warehouseManagerRole.menuPermissions.filter(rmp =>
    pricingMenuKeys.includes(rmp.menuPermission.key)
  )

  if (assignedPricingMenus.length === 0) {
    console.log(`   ❌ NO pricing menus assigned to Warehouse Manager role!`)
  } else {
    console.log(`   ✅ Found ${assignedPricingMenus.length} pricing menu(s):`)
    assignedPricingMenus.forEach(rmp => {
      console.log(`      - ${rmp.menuPermission.name} (${rmp.menuPermission.key})`)
    })
  }

  // Check missing ones
  const assignedKeys = new Set(assignedPricingMenus.map(rmp => rmp.menuPermission.key))
  const missingPricingMenus = pricingMenus.filter(m => !assignedKeys.has(m.key))

  if (missingPricingMenus.length > 0) {
    console.log(`\n⚠️  MISSING from Warehouse Manager role:`)
    missingPricingMenus.forEach(m => {
      console.log(`      - ${m.name} (${m.key})`)
    })
  }

  // Now check all menus assigned to Warehouse Manager
  console.log(`\n📊 All Menus Assigned to Warehouse Manager Role (${warehouseManagerRole.menuPermissions.length} total):`)
  const menusByCategory: Record<string, typeof pricingMenus> = {}

  for (const rmp of warehouseManagerRole.menuPermissions) {
    const menu = rmp.menuPermission
    const category = menu.parentId ? 'child' : 'parent'

    if (!menusByCategory[category]) {
      menusByCategory[category] = []
    }
    menusByCategory[category].push(menu)
  }

  if (menusByCategory['parent']) {
    console.log(`\n   Parent Menus (${menusByCategory['parent'].length}):`)
    menusByCategory['parent'].forEach(m => {
      console.log(`      - ${m.name} (${m.key})`)
    })
  }

  if (menusByCategory['child']) {
    console.log(`\n   Child Menus (${menusByCategory['child'].length}):`)
    menusByCategory['child'].forEach(m => {
      console.log(`      - ${m.name} (${m.key}) [parent ID: ${m.parentId}]`)
    })
  }

  console.log('\n' + '='.repeat(80))

  // Provide fix recommendation
  if (missingPricingMenus.length > 0) {
    console.log(`\n💡 RECOMMENDATION:`)
    console.log(`\n   The checked menus in the UI are NOT actually saved in the database.`)
    console.log(`   This could be due to:`)
    console.log(`   1. JavaScript error preventing save`)
    console.log(`   2. Session expired when saving`)
    console.log(`   3. Database transaction rolled back`)
    console.log(`\n   SOLUTION: Add the missing menus manually\n`)

    // Offer to fix
    console.log(`\n❓ Would you like to add these menus to Warehouse Manager role? (Run with --fix flag)`)
  } else {
    console.log(`\n✅ All pricing menus are correctly assigned!`)
    console.log(`\n💡 If they're still not appearing in sidebar, try:`)
    console.log(`   1. Log out and log back in (clear session)`)
    console.log(`   2. Clear browser cache`)
    console.log(`   3. Check browser console for errors`)
  }

  console.log('\n')
}

// Check for --fix flag
const shouldFix = process.argv.includes('--fix')

if (shouldFix) {
  console.log('🔧 FIX MODE ENABLED\n')
  fixPricingMenus()
} else {
  diagnosePricingMenuIssue().finally(() => prisma.$disconnect())
}

async function fixPricingMenus() {
  console.log('\n🔧 FIXING PRICING MENU PERMISSIONS')
  console.log('='.repeat(80))

  // Find Warehouse Manager role
  const warehouseManagerRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'Warehouse', mode: 'insensitive' }
    }
  })

  if (!warehouseManagerRole) {
    console.log('❌ Warehouse Manager role not found')
    prisma.$disconnect()
    return
  }

  // Get all pricing menus
  const pricingMenus = await prisma.menuPermission.findMany({
    where: {
      OR: [
        { key: 'pricing_management' },
        { key: 'bulk_price_editor' },
        { key: 'pricing_settings' }
      ]
    }
  })

  console.log(`\n📋 Adding ${pricingMenus.length} pricing menus to Warehouse Manager role...`)

  for (const menu of pricingMenus) {
    // Check if already exists
    const existing = await prisma.roleMenuPermission.findUnique({
      where: {
        roleId_menuPermissionId: {
          roleId: warehouseManagerRole.id,
          menuPermissionId: menu.id
        }
      }
    })

    if (existing) {
      console.log(`   ✓ ${menu.name} - already assigned`)
    } else {
      await prisma.roleMenuPermission.create({
        data: {
          roleId: warehouseManagerRole.id,
          menuPermissionId: menu.id
        }
      })
      console.log(`   ✅ ${menu.name} - ADDED`)
    }
  }

  console.log('\n✅ Done! Pricing menus have been added to Warehouse Manager role.')
  console.log('\n📝 Next steps:')
  console.log('   1. Log out of the application')
  console.log('   2. Log back in')
  console.log('   3. The pricing child menus should now appear')

  console.log('\n' + '='.repeat(80))
  console.log('\n')

  prisma.$disconnect()
}
