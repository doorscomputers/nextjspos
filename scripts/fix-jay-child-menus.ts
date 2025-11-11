import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixJayChildMenus() {
  try {
    console.log('🔧 Fixing child menu permissions for Cross-Location Approver\n')

    // Find the role
    const role = await prisma.role.findFirst({
      where: { name: 'Cross-Location Approver' },
      select: { id: true, name: true }
    })

    if (!role) {
      console.error('❌ Role not found!')
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})\n`)

    // Get ALL menu permissions with their hierarchy
    const allMenus = await prisma.menuPermission.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        parentId: true,
        href: true
      },
      orderBy: { order: 'asc' }
    })

    // Find Purchases and Stock Transfers parent menus
    const purchasesParent = allMenus.find(m => m.key === 'purchases')
    const stockTransfersParent = allMenus.find(m => m.key === 'stock_transfers')
    const posParent = allMenus.find(m => m.key === 'pos_sales')

    console.log('📋 PARENT MENUS FOUND:')
    if (purchasesParent) console.log(`  - Purchases (ID: ${purchasesParent.id})`)
    if (stockTransfersParent) console.log(`  - Stock Transfers (ID: ${stockTransfersParent.id})`)
    if (posParent) console.log(`  - POS & Sales (ID: ${posParent.id})`)
    console.log('')

    // Find all children of these parents
    const purchaseChildren = purchasesParent
      ? allMenus.filter(m => m.parentId === purchasesParent.id)
      : []

    const transferChildren = stockTransfersParent
      ? allMenus.filter(m => m.parentId === stockTransfersParent.id)
      : []

    const posChildren = posParent
      ? allMenus.filter(m => m.parentId === posParent.id)
      : []

    console.log('📋 CHILD MENUS FOUND:')
    console.log('\nUnder PURCHASES:')
    if (purchaseChildren.length === 0) {
      console.log('  ⚠️  No child menus found')
    } else {
      purchaseChildren.forEach(child => {
        console.log(`  - ${child.key} (${child.name}) - ${child.href}`)
      })
    }

    console.log('\nUnder STOCK TRANSFERS:')
    if (transferChildren.length === 0) {
      console.log('  ⚠️  No child menus found')
    } else {
      transferChildren.forEach(child => {
        console.log(`  - ${child.key} (${child.name}) - ${child.href}`)
      })
    }

    console.log('\nUnder POS & SALES:')
    if (posChildren.length === 0) {
      console.log('  ⚠️  No child menus found')
    } else {
      posChildren.forEach(child => {
        console.log(`  - ${child.key} (${child.name}) - ${child.href}`)
      })
    }
    console.log('')

    // Collect all menu IDs to assign (parents + children)
    const menuIdsToAssign = [
      ...(purchasesParent ? [purchasesParent.id] : []),
      ...purchaseChildren.map(c => c.id),
      ...(stockTransfersParent ? [stockTransfersParent.id] : []),
      ...transferChildren.map(c => c.id),
      ...(posParent ? [posParent.id] : []),
      ...posChildren.map(c => c.id),
    ]

    if (menuIdsToAssign.length === 0) {
      console.log('⚠️  No menu IDs to assign')
      return
    }

    // Check existing assignments
    const existingAssignments = await prisma.roleMenuPermission.findMany({
      where: {
        roleId: role.id,
        menuPermissionId: { in: menuIdsToAssign }
      },
      select: { menuPermissionId: true }
    })

    const existingIds = new Set(existingAssignments.map(ea => ea.menuPermissionId))
    const newIds = menuIdsToAssign.filter(id => !existingIds.has(id))

    console.log(`📊 ASSIGNMENT STATUS:`)
    console.log(`  Total menus to assign: ${menuIdsToAssign.length}`)
    console.log(`  Already assigned: ${existingIds.size}`)
    console.log(`  New to assign: ${newIds.length}`)
    console.log('')

    if (newIds.length === 0) {
      console.log('✅ All child menus already assigned!')
      return
    }

    // Assign new menus
    console.log('🔨 Assigning new child menus...')
    const createData = newIds.map(menuId => ({
      roleId: role.id,
      menuPermissionId: menuId
    }))

    const result = await prisma.roleMenuPermission.createMany({
      data: createData,
      skipDuplicates: true
    })

    console.log(`✅ Successfully assigned ${result.count} new menu permissions!`)
    console.log('')

    // Show what was newly assigned
    const newlyAssignedMenus = allMenus.filter(m => newIds.includes(m.id))
    console.log('📝 NEWLY ASSIGNED:')
    newlyAssignedMenus.forEach(menu => {
      console.log(`  ✓ ${menu.key} - ${menu.name}`)
    })
    console.log('')

    // Final count
    const finalCount = await prisma.roleMenuPermission.count({
      where: { roleId: role.id }
    })

    console.log('✅ DONE!')
    console.log(`📊 Total menu permissions: ${finalCount}`)
    console.log('\n🔄 Please ask Jay to refresh the browser page.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixJayChildMenus()
