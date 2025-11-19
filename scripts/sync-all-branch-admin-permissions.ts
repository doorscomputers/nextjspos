import { PrismaClient } from '@prisma/client'
import { DEFAULT_ROLES, PERMISSIONS } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function syncAllBranchAdminPermissions() {
  try {
    console.log('🔄 Syncing "All Branch Admin" role permissions from DEFAULT_ROLES...\n')

    // Find the role
    const role = await prisma.role.findFirst({
      where: {
        name: 'All Branch Admin'
      }
    })

    if (!role) {
      console.error('❌ "All Branch Admin" role not found')
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})`)

    // Get the role configuration from DEFAULT_ROLES
    const roleConfig = DEFAULT_ROLES.ALL_BRANCH_ADMIN
    if (!roleConfig) {
      console.error('❌ ALL_BRANCH_ADMIN not found in DEFAULT_ROLES')
      return
    }

    console.log(`📋 Role should have ${roleConfig.permissions.length} permissions`)

    // Get all permission records from database
    const allPermissions = await prisma.permission.findMany()
    console.log(`✅ Found ${allPermissions.length} permissions in database`)

    // Delete existing role permissions
    const deleted = await prisma.rolePermission.deleteMany({
      where: { roleId: role.id }
    })
    console.log(`✅ Removed ${deleted.count} existing permission(s)`)

    // Assign ALL permissions to the role (as per DEFAULT_ROLES.ALL_BRANCH_ADMIN)
    let assignedCount = 0
    for (const permName of roleConfig.permissions) {
      const permission = allPermissions.find(p => p.name === permName)

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          }
        })
        assignedCount++
      } else {
        console.warn(`⚠️ Permission "${permName}" not found in database`)
      }
    }

    console.log(`✅ Assigned ${assignedCount} permission(s) to "All Branch Admin"`)

    // Verify ACCESS_ALL_LOCATIONS was included
    const accessAllLocPerm = allPermissions.find(p => p.name === PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (accessAllLocPerm) {
      console.log(`\n✅ ACCESS_ALL_LOCATIONS permission included`)
    } else {
      console.log(`\n⚠️ ACCESS_ALL_LOCATIONS permission not found in database`)
    }

    console.log('\n🎉 Done! "All Branch Admin" role now has full system access.')
    console.log('   Users with this role will see all business locations.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

syncAllBranchAdminPermissions()
