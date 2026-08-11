import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Assign Menu Permissions to the Transfer Manager role
 *
 * Grants sidebar visibility for Branch Stock Pivot V2 (plus the Products
 * parent menu) so transfer managers can see per-branch stock quantities
 * when deciding which branch to send Warehouse stock to.
 *
 * Run: npx tsx scripts/assign-menus-transfer-manager.ts
 */

const ROLE_NAME = 'Transfer Manager'

const MENU_KEYS_TO_ASSIGN = [
  'products',              // parent menu (required for children to show)
  'branch_stock_pivot_v2', // Branch Stock Pivot V2 report
]

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

assignMenusToRole()
