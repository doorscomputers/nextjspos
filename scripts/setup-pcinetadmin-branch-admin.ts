import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupPcinetAdminAsBranchAdmin() {
  try {
    console.log('🔧 Setting up pcinetadmin as Branch Admin with all locations...')

    // Get the user
    const user = await prisma.user.findUnique({
      where: { username: 'pcinetadmin' },
      include: { business: true }
    })

    if (!user) {
      console.error('❌ User "pcinetadmin" not found')
      return
    }

    console.log(`✅ Found user: ${user.username}`)

    // Get all business locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: user.businessId! },
      orderBy: { id: 'asc' }
    })

    console.log(`✅ Found ${locations.length} business locations`)

    // Remove all existing roles
    await prisma.userRole.deleteMany({
      where: { userId: user.id }
    })
    console.log('✅ Removed existing roles')

    // Get Admin role (or Branch Manager)
    let adminRole = await prisma.role.findFirst({
      where: {
        businessId: user.businessId!,
        name: 'Admin'
      }
    })

    // If Admin doesn't exist, try Branch Manager
    if (!adminRole) {
      adminRole = await prisma.role.findFirst({
        where: {
          businessId: user.businessId!,
          name: 'Branch Manager'
        }
      })
    }

    // If neither exists, create an Admin role
    if (!adminRole) {
      console.log('Creating Admin role...')
      adminRole = await prisma.role.create({
        data: {
          name: 'Admin',
          businessId: user.businessId!,
          guardName: 'web',
          isDefault: false,
        }
      })

      // Get all permissions
      const allPermissions = await prisma.permission.findMany()

      // Assign all permissions to Admin role
      for (const permission of allPermissions) {
        await prisma.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id,
          }
        })
      }
      console.log('✅ Created Admin role with all permissions')
    }

    // Assign the role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
      }
    })
    console.log(`✅ Assigned role: ${adminRole.name}`)

    // Remove all existing location assignments
    await prisma.userLocation.deleteMany({
      where: { userId: user.id }
    })
    console.log('✅ Removed existing location assignments')

    // Assign all locations
    for (const location of locations) {
      await prisma.userLocation.create({
        data: {
          userId: user.id,
          locationId: location.id,
        }
      })
      console.log(`   ✓ Assigned location: ${location.name}`)
    }

    console.log('\n🎉 Setup complete!')
    console.log('─'.repeat(60))
    console.log('Username: pcinetadmin')
    console.log('Password: 111111')
    console.log(`Role:     ${adminRole.name}`)
    console.log(`Locations: ${locations.map(l => l.name).join(', ')}`)
    console.log('─'.repeat(60))
    console.log('\n💡 You will now be prompted to select a location when logging in.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupPcinetAdminAsBranchAdmin()
