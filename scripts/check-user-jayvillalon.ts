import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUser() {
  try {
    console.log('🔍 Checking user: jayvillalon\n')

    const user = await prisma.user.findUnique({
      where: { username: 'jayvillalon' },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
        userLocations: {
          include: {
            location: true,
          },
        },
      },
    })

    if (!user) {
      console.error('❌ User "jayvillalon" not found!')
      return
    }

    console.log('✅ User Found:')
    console.log('=====================================')
    console.log(`ID: ${user.id}`)
    console.log(`Username: ${user.username}`)
    console.log(`Name: ${user.firstName} ${user.lastName || ''}`)
    console.log(`Email: ${user.email}`)
    console.log(`Business: ${user.business?.name || 'N/A'} (ID: ${user.businessId})`)
    console.log(`Allow Login: ${user.allowLogin}`)
    console.log(`Active: ${user.isActive}`)
    console.log('')

    // Check roles
    console.log('👤 ROLES ASSIGNED:')
    console.log('=====================================')
    if (user.roles.length === 0) {
      console.log('⚠️  NO ROLES ASSIGNED - This is the problem!')
    } else {
      user.roles.forEach((userRole) => {
        console.log(`- ${userRole.role.name}`)
        console.log(`  Permissions from role: ${userRole.role.permissions.length}`)
      })
    }
    console.log('')

    // Check direct permissions
    console.log('🔑 DIRECT PERMISSIONS:')
    console.log('=====================================')
    if (user.permissions.length === 0) {
      console.log('⚠️  No direct permissions assigned')
    } else {
      user.permissions.forEach((userPerm) => {
        console.log(`- ${userPerm.permission.name}`)
      })
    }
    console.log('')

    // Collect all permissions
    const rolePermissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name)
    )
    const directPermissions = user.permissions.map((up) => up.permission.name)
    const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

    console.log('📊 TOTAL PERMISSIONS COUNT:')
    console.log('=====================================')
    console.log(`From Roles: ${rolePermissions.length}`)
    console.log(`Direct: ${directPermissions.length}`)
    console.log(`Total Unique: ${allPermissions.length}`)
    console.log('')

    // Check location assignments
    console.log('📍 LOCATION ASSIGNMENTS:')
    console.log('=====================================')
    if (user.userLocations.length === 0) {
      console.log('⚠️  No locations assigned')
    } else {
      user.userLocations.forEach((ul) => {
        console.log(`- ${ul.location.name} (ID: ${ul.locationId})`)
      })
    }
    console.log('')

    // Diagnosis
    console.log('🩺 DIAGNOSIS:')
    console.log('=====================================')
    if (user.roles.length === 0) {
      console.log('❌ PROBLEM: User has NO ROLES assigned')
      console.log('   Solution: Assign at least one role to this user')
    } else if (allPermissions.length === 0) {
      console.log('❌ PROBLEM: User has roles but NO PERMISSIONS')
      console.log('   Solution: Check if the assigned roles have permissions')
    } else if (!allPermissions.includes('dashboard.view')) {
      console.log('❌ PROBLEM: User lacks "dashboard.view" permission')
      console.log('   Solution: Ensure user has dashboard.view permission to see menus')
    } else if (user.userLocations.length === 0) {
      console.log('⚠️  WARNING: User has no location assignments')
      console.log('   This may limit access to location-specific features')
    } else {
      console.log('✅ User has roles and permissions assigned')
      console.log('   Check if specific menu permissions are missing')
    }

    // Sample of permissions
    if (allPermissions.length > 0) {
      console.log('')
      console.log('📝 SAMPLE PERMISSIONS (first 20):')
      console.log('=====================================')
      allPermissions.slice(0, 20).forEach((perm) => {
        console.log(`- ${perm}`)
      })
      if (allPermissions.length > 20) {
        console.log(`... and ${allPermissions.length - 20} more`)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()
