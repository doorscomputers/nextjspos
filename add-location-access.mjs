import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addLocationAccessPermission() {
  try {
    console.log('🔍 Searching for Warehouse_manager role...\n')

    // Find Warehouse_manager role
    const role = await prisma.role.findFirst({
      where: {
        name: {
          contains: 'warehouse',
          mode: 'insensitive',
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!role) {
      console.log('❌ Warehouse_manager role not found!')
      console.log('   Available roles:')
      const allRoles = await prisma.role.findMany({
        select: { id: true, name: true, businessId: true },
      })
      allRoles.forEach(r => console.log(`   - ${r.name} (ID: ${r.id}, Business: ${r.businessId})`))
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id}, Business: ${role.businessId})\n`)

    // Check if ACCESS_ALL_LOCATIONS permission exists
    const locationPermission = await prisma.permission.findUnique({
      where: {
        name: 'access_all_locations',
      },
    })

    if (!locationPermission) {
      console.log('❌ Permission "access_all_locations" not found in database!')
      return
    }

    console.log(`✅ Found permission: ${locationPermission.name} (ID: ${locationPermission.id})\n`)

    // Check if role already has this permission
    const existingRolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: locationPermission.id,
        },
      },
    })

    if (existingRolePermission) {
      console.log('ℹ️  Role already has ACCESS_ALL_LOCATIONS permission!')
      console.log('   The issue might be that the user needs to log out and log back in.')
      return
    }

    // Add permission to role
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: locationPermission.id,
      },
    })

    console.log('✅ Successfully added ACCESS_ALL_LOCATIONS permission to Warehouse_manager role!')
    console.log('\n⚠️  IMPORTANT: Users with this role need to:')
    console.log('   1. Log out completely')
    console.log('   2. Log back in')
    console.log('   3. Then they will be able to access all locations\n')

    // Show current permissions
    console.log('📋 Current permissions for Warehouse_manager role:')
    const updatedRole = await prisma.role.findUnique({
      where: { id: role.id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    updatedRole?.permissions.forEach(rp => {
      console.log(`   - ${rp.permission.name}`)
    })
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addLocationAccessPermission()
