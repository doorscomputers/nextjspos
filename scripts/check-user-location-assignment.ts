import { prisma } from '../src/lib/prisma.simple.js'

async function checkUserLocationAssignment() {
  try {
    console.log('Checking user location assignments...\n')

    // Check Jheiron user specifically (capital J)
    const user = await prisma.user.findFirst({
      where: {
        username: 'Jheiron'
      },
      include: {
        userLocations: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
                isActive: true,
                deletedAt: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log(`User: ${user.username} (ID: ${user.id})`)
    console.log(`Business ID: ${user.businessId}`)
    console.log(`\nAssigned Locations (${user.userLocations.length}):`)
    console.log('='.repeat(60))

    if (user.userLocations.length === 0) {
      console.log('⚠️  NO LOCATIONS ASSIGNED TO THIS USER!')
      console.log('\nThis is why the "Receiving Location" field is blank!')
      console.log('\nSolution: Assign a location to this user in the database')
    } else {
      user.userLocations.forEach((ul, index) => {
        console.log(`${index + 1}. Location ID: ${ul.location.id}`)
        console.log(`   Name: ${ul.location.name}`)
        console.log(`   Active: ${ul.location.isActive}`)
        console.log(`   Deleted: ${ul.location.deletedAt ? 'Yes' : 'No'}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserLocationAssignment()
