import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkWarehouseRoles() {
  try {
    console.log('🔍 Checking warehouse-related roles...\n')

    // Find all roles that might be related to warehouse operations
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: 'Purchase', mode: 'insensitive' } },
          { name: { contains: 'GRN', mode: 'insensitive' } },
          { name: { contains: 'Transfer', mode: 'insensitive' } },
          { name: { contains: 'Warehouse', mode: 'insensitive' } },
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (roles.length === 0) {
      console.log('❌ No warehouse-related roles found!')
      return
    }

    console.log(`Found ${roles.length} warehouse-related roles:\n`)

    for (const role of roles) {
      console.log(`📋 ${role.name} (ID: ${role.id}, Business: ${role.businessId})`)

      // Check if role has ACCESS_ALL_LOCATIONS
      const hasLocationAccess = role.permissions.some(
        rp => rp.permission.name === 'access_all_locations'
      )

      if (hasLocationAccess) {
        console.log('   ✅ HAS access_all_locations permission')
      } else {
        console.log('   ❌ MISSING access_all_locations permission')
      }

      // Show all permissions
      console.log('   Permissions:')
      role.permissions.forEach(rp => {
        console.log(`      - ${rp.permission.name}`)
      })
      console.log('')
    }

    // Check if ACCESS_ALL_LOCATIONS permission exists
    const locationPermission = await prisma.permission.findUnique({
      where: { name: 'access_all_locations' },
    })

    if (!locationPermission) {
      console.log('❌ Permission "access_all_locations" not found in database!')
      return
    }

    // Find roles that need the permission
    const rolesNeedingPermission = roles.filter(role =>
      !role.permissions.some(rp => rp.permission.name === 'access_all_locations')
    )

    if (rolesNeedingPermission.length > 0) {
      console.log('⚠️  The following roles need ACCESS_ALL_LOCATIONS permission:')
      rolesNeedingPermission.forEach(role => {
        console.log(`   - ${role.name} (ID: ${role.id})`)
      })
      console.log('\n🔧 Adding ACCESS_ALL_LOCATIONS to these roles...\n')

      // Add permission to each role
      for (const role of rolesNeedingPermission) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: locationPermission.id,
          },
        })
        console.log(`   ✅ Added to ${role.name}`)
      }

      console.log('\n✅ All warehouse roles now have ACCESS_ALL_LOCATIONS permission!')
      console.log('\n⚠️  IMPORTANT: Users need to log out and log back in to get updated permissions.\n')
    } else {
      console.log('✅ All warehouse roles already have ACCESS_ALL_LOCATIONS permission!\n')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWarehouseRoles()
