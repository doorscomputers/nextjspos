import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removePcinetAdminLocations() {
  try {
    console.log('🔧 Removing all location assignments from pcinetadmin...')

    // Get the user
    const user = await prisma.user.findUnique({
      where: { username: 'pcinetadmin' },
      include: {
        business: true,
        userLocations: {
          include: { location: true }
        }
      }
    })

    if (!user) {
      console.error('❌ User "pcinetadmin" not found')
      return
    }

    console.log(`✅ Found user: ${user.username}`)
    console.log(`   Current locations: ${user.userLocations.length}`)

    if (user.userLocations.length > 0) {
      user.userLocations.forEach(ul => {
        console.log(`   - ${ul.location.name}`)
      })
    }

    // Remove all location assignments
    const deleted = await prisma.userLocation.deleteMany({
      where: { userId: user.id }
    })

    console.log(`\n✅ Removed ${deleted.count} location assignment(s)`)

    console.log('\n🎉 Done!')
    console.log('─'.repeat(60))
    console.log('Username: pcinetadmin')
    console.log('Password: 111111')
    console.log('Role:     All Branch Admin')
    console.log('Locations: None (will access all via role permissions)')
    console.log('─'.repeat(60))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

removePcinetAdminLocations()
