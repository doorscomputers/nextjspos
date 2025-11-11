import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Fix menu permissions for Cross-Location Approver role
 * This role currently has RBAC permissions but no menu permissions,
 * causing users with this role to see an empty sidebar.
 */
async function fixCrossLocationApproverMenus() {
  try {
    console.log('🔧 Fixing menu permissions for Cross-Location Approver role\n')

    // Find the role
    const role = await prisma.role.findFirst({
      where: { name: 'Cross-Location Approver' },
      select: { id: true, name: true, businessId: true }
    })

    if (!role) {
      console.error('❌ Role "Cross-Location Approver" not found!')
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})`)
    console.log('')

    // Define menu keys that this role should have access to
    // Based on their RBAC permissions:
    // - dashboard.view, product.view, purchase.view, purchase.create, report.view
    // - sell.view, reading.z_reading, stock_transfer.*, report.*, access_all_locations
    const menuKeysToAssign = [
      'dashboard',              // Dashboard
      'products',               // Products (view)
      'pos_sales',              // POS & Sales
      'purchases',              // Purchases
      'purchase_list',          // Purchase List
      'add_purchase',           // Add Purchase
      'stock_transfers',        // Stock Transfers
      'transfer_list',          // Transfer List
      'reports',                // Reports parent menu
      'sales_reports',          // Sales Reports section
      'z_reading',              // Z Reading
      'purchase_reports',       // Purchase Reports section
      'purchase_items_report',  // Purchase Items Report
      'transfer_reports',       // Transfer Reports section
      'inventory_reports',      // Inventory Reports section
      'stock_report',           // Stock Report
    ]

    console.log('📋 Menu keys to assign:')
    menuKeysToAssign.forEach(key => console.log(`  - ${key}`))
    console.log('')

    // Get all menu permissions that match these keys
    const menuPermissions = await prisma.menuPermission.findMany({
      where: {
        key: { in: menuKeysToAssign }
      },
      select: {
        id: true,
        key: true,
        name: true
      }
    })

    if (menuPermissions.length === 0) {
      console.error('❌ No menu permissions found matching the specified keys!')
      console.log('   Make sure menu permissions are seeded in the database.')
      return
    }

    console.log(`✅ Found ${menuPermissions.length} menu permissions in database`)
    console.log('')

    // Check which are already assigned
    const existingAssignments = await prisma.roleMenuPermission.findMany({
      where: {
        roleId: role.id,
        menuPermissionId: { in: menuPermissions.map(mp => mp.id) }
      },
      select: {
        menuPermissionId: true
      }
    })

    const existingIds = new Set(existingAssignments.map(ea => ea.menuPermissionId))
    const newAssignments = menuPermissions.filter(mp => !existingIds.has(mp.id))

    console.log(`📊 Status:`)
    console.log(`  Already assigned: ${existingAssignments.length}`)
    console.log(`  New to assign: ${newAssignments.length}`)
    console.log('')

    if (newAssignments.length === 0) {
      console.log('✅ All menu permissions are already assigned!')
      return
    }

    // Create new assignments
    console.log('🔨 Creating new menu permission assignments...')
    const createData = newAssignments.map(mp => ({
      roleId: role.id,
      menuPermissionId: mp.id
    }))

    const result = await prisma.roleMenuPermission.createMany({
      data: createData,
      skipDuplicates: true
    })

    console.log(`✅ Successfully assigned ${result.count} menu permissions!`)
    console.log('')

    // Show what was assigned
    console.log('📝 Newly assigned menu permissions:')
    newAssignments.forEach(mp => {
      console.log(`  ✓ ${mp.key} - ${mp.name}`)
    })
    console.log('')

    // Verify total count
    const totalCount = await prisma.roleMenuPermission.count({
      where: { roleId: role.id }
    })

    console.log('📊 FINAL STATUS:')
    console.log('=====================================')
    console.log(`Total menu permissions for "${role.name}": ${totalCount}`)
    console.log('')
    console.log('✅ DONE! Users with "Cross-Location Approver" role should now see sidebar menus.')
    console.log('   Please refresh the browser page to see the changes.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixCrossLocationApproverMenus()
