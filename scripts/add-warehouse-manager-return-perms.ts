import { prisma } from '../src/lib/prisma.simple'

async function addPermissions() {
  try {
    console.log('🔧 Adding purchase return permissions to Warehouse Manager role...\n')

    // Find Warehouse Manager role
    const role = await prisma.role.findFirst({
      where: { name: 'Warehouse Manager' },
    })

    if (!role) {
      console.log('❌ Warehouse Manager role not found!')
      return
    }

    console.log(`✅ Found Warehouse Manager role (ID: ${role.id})`)

    // Find the permissions
    const permissions = await prisma.permission.findMany({
      where: {
        name: {
          in: ['purchase_return.view', 'purchase_return.approve'],
        },
      },
    })

    console.log(`✅ Found ${permissions.length} permissions to add`)

    // Add permissions to role
    for (const permission of permissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      })

      if (existing) {
        console.log(`   ⏭️  Already exists: ${permission.name}`)
      } else {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        })
        console.log(`   ✅ Added: ${permission.name}`)
      }
    }

    console.log('\n✅ Done! Warehouse Manager now has purchase return permissions.')
    console.log('\n⚠️  Note: Users need to log out and log back in for changes to take effect.')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addPermissions()
