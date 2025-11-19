import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignAllBranchAdminRole() {
  try {
    console.log('🔧 Assigning "All Branch Admin" role to pcinetadmin...')

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

    // Remove all existing roles
    const deletedRoles = await prisma.userRole.deleteMany({
      where: { userId: user.id }
    })
    console.log(`✅ Removed ${deletedRoles.count} existing role(s)`)

    // Find "All Branch Admin" role
    const allBranchAdminRole = await prisma.role.findFirst({
      where: {
        businessId: user.businessId!,
        name: 'All Branch Admin'
      }
    })

    if (!allBranchAdminRole) {
      console.error('❌ "All Branch Admin" role not found')
      console.log('\n📋 Available roles in the system:')
      const allRoles = await prisma.role.findMany({
        where: { businessId: user.businessId! },
        orderBy: { name: 'asc' }
      })
      allRoles.forEach(role => {
        console.log(`   - ${role.name}`)
      })
      return
    }

    console.log(`✅ Found role: ${allBranchAdminRole.name}`)

    // Assign the role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: allBranchAdminRole.id,
      }
    })

    console.log('✅ Role assigned successfully!')

    // Get user locations
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: user.id },
      include: { location: true }
    })

    console.log('\n🎉 Setup complete!')
    console.log('─'.repeat(60))
    console.log('Username: pcinetadmin')
    console.log('Password: 111111')
    console.log(`Role:     ${allBranchAdminRole.name}`)
    console.log(`Locations: ${userLocations.length > 0 ? userLocations.map(l => l.location.name).join(', ') : 'All (via permission)'}`)
    console.log('─'.repeat(60))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignAllBranchAdminRole()
