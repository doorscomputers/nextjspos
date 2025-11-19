import { PrismaClient } from '@prisma/client'
import { PERMISSIONS } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function emergencyRestore() {
  console.log('\n🚨 EMERGENCY RESTORE - Critical System Data\n')
  console.log('=' .repeat(60))

  try {
    // Step 1: Assign Super Admin role to superadmin user
    console.log('\n📋 Step 1: Assigning Super Admin role to superadmin user...')

    const superadminUser = await prisma.user.findFirst({
      where: { username: 'superadmin' }
    })

    if (!superadminUser) {
      console.error('❌ ERROR: superadmin user not found!')
      return
    }

    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' }
    })

    if (!superAdminRole) {
      console.error('❌ ERROR: Super Admin role not found!')
      return
    }

    // Delete existing assignment if any
    await prisma.userRole.deleteMany({
      where: {
        userId: superadminUser.id,
        roleId: superAdminRole.id
      }
    })

    // Create new assignment
    await prisma.userRole.create({
      data: {
        userId: superadminUser.id,
        roleId: superAdminRole.id
      }
    })

    console.log('✅ Super Admin role assigned to superadmin user')

    // Step 2: Assign ALL permissions to Super Admin role
    console.log('\n📋 Step 2: Assigning ALL permissions to Super Admin role...')

    const allPermissions = await prisma.permission.findMany()
    console.log(`   Found ${allPermissions.length} permissions in database`)

    // Clear existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId: superAdminRole.id }
    })

    // Assign all permissions
    const rolePermissions = allPermissions.map(permission => ({
      roleId: superAdminRole.id,
      permissionId: permission.id
    }))

    await prisma.rolePermission.createMany({
      data: rolePermissions,
      skipDuplicates: true
    })

    console.log(`✅ Assigned ${rolePermissions.length} permissions to Super Admin role`)

    // Step 3: Assign all menus to Super Admin role
    console.log('\n📋 Step 3: Assigning ALL menus to Super Admin role...')

    const allMenus = await prisma.menuPermission.findMany()
    console.log(`   Found ${allMenus.length} menus in database`)

    // Clear existing menu permissions
    await prisma.roleMenuPermission.deleteMany({
      where: { roleId: superAdminRole.id }
    })

    // Assign all menus
    const menuPermissions = allMenus.map(menu => ({
      roleId: superAdminRole.id,
      menuPermissionId: menu.id
    }))

    await prisma.roleMenuPermission.createMany({
      data: menuPermissions,
      skipDuplicates: true
    })

    console.log(`✅ Assigned ${menuPermissions.length} menus to Super Admin role`)

    // Step 4: Verify
    console.log('\n📋 Step 4: Verifying restoration...')

    const userRolesCount = await prisma.userRole.count({
      where: { userId: superadminUser.id }
    })

    const rolePermissionsCount = await prisma.rolePermission.count({
      where: { roleId: superAdminRole.id }
    })

    const roleMenuPermissionsCount = await prisma.roleMenuPermission.count({
      where: { roleId: superAdminRole.id }
    })

    console.log(`   ✓ User roles: ${userRolesCount}`)
    console.log(`   ✓ Role permissions: ${rolePermissionsCount}`)
    console.log(`   ✓ Role menu permissions: ${roleMenuPermissionsCount}`)

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ EMERGENCY RESTORE COMPLETED!\n')
    console.log('💡 You can now login as superadmin and the system should work.')
    console.log('💡 Next step: Restore other role permissions using Menu Permissions page.')

  } catch (error) {
    console.error('\n❌ ERROR during emergency restore:', error)
  } finally {
    await prisma.$disconnect()
  }
}

emergencyRestore()
