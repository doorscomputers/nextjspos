import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * TEMPLATE: Assign Menu Permissions to Any Role
 *
 * Copy this file and customize for each role you want to configure.
 * This prevents menu permissions from being lost when running seed commands.
 *
 * HOW TO USE:
 * 1. Copy this file: cp TEMPLATE-assign-menus-to-role.ts assign-menus-ROLENAME.ts
 * 2. Edit ROLE_NAME and MENU_KEYS_TO_ASSIGN below
 * 3. Run: npx tsx scripts/assign-menus-ROLENAME.ts
 */

// ========================================
// CONFIGURATION - EDIT THESE VALUES
// ========================================

const ROLE_NAME = 'YOUR_ROLE_NAME_HERE' // e.g., 'Cashier', 'Manager', 'Cross-Location Approver'

const MENU_KEYS_TO_ASSIGN = [
  // ========================================
  // EDIT THIS LIST WITH MENU KEYS TO ASSIGN
  // ========================================

  // Dashboard (always include)
  'dashboard',

  // Products
  // 'products',

  // POS & Sales
  // 'pos_sales',
  // 'point_of_sale',
  // 'begin_shift',
  // 'close_shift',
  // 'x_reading',
  // 'z_reading',
  // 'readings_history',
  // 'sales_list',

  // Purchases
  // 'purchases',
  // 'purchases_list',
  // 'purchases_add',
  // 'purchase_orders',
  // 'goods_received',
  // 'serial_number_lookup',
  // 'reorder_suggestions',
  // 'accounts_payable',
  // 'payments',
  // 'banks',
  // 'bank_transactions',
  // 'post_dated_cheques',

  // Stock Transfers
  // 'stock_transfers',
  // 'all_transfers',
  // 'create_transfer',
  // 'my_transfers_report',
  // 'my_received_transfers_report',

  // Reports
  // 'reports',
  // 'sales_reports',
  // 'purchase_reports',
  // 'purchase_items_report',
  // 'transfer_reports',
  // 'inventory_reports',

  // Settings
  // 'settings',
  // 'user_menu_manager',
]

// ========================================
// DO NOT EDIT BELOW THIS LINE
// ========================================

async function assignMenusToRole() {
  try {
    console.log(`🔧 Assigning menu permissions to role: ${ROLE_NAME}\n`)

    // Find the role
    const role = await prisma.role.findFirst({
      where: { name: ROLE_NAME },
      select: { id: true, name: true, businessId: true }
    })

    if (!role) {
      console.error(`❌ Role "${ROLE_NAME}" not found!`)
      console.log('\n💡 TIP: Check available roles with:')
      console.log('   npx prisma studio')
      console.log('   Then navigate to the Role table')
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})`)
    console.log('')

    console.log('📋 Menu keys to assign:')
    MENU_KEYS_TO_ASSIGN.forEach(key => console.log(`  - ${key}`))
    console.log('')

    // Get all menu permissions that match these keys
    const menuPermissions = await prisma.menuPermission.findMany({
      where: {
        key: { in: MENU_KEYS_TO_ASSIGN }
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
    console.log(`✅ DONE! Users with "${role.name}" role should now see these menus.`)
    console.log('   Users must log out and log back in to see the changes.')

    // Show list of missing keys (keys that were requested but not found in database)
    const foundKeys = new Set(menuPermissions.map(mp => mp.key))
    const missingKeys = MENU_KEYS_TO_ASSIGN.filter(key => !foundKeys.has(key))

    if (missingKeys.length > 0) {
      console.log('')
      console.log('⚠️  WARNING: Some requested menu keys were not found in database:')
      missingKeys.forEach(key => {
        console.log(`  - ${key}`)
      })
      console.log('   These may be incorrect keys or the menus need to be seeded first.')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the function
assignMenusToRole()
