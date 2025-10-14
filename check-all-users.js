const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('All users in database:\n')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      businessId: true,
    },
    orderBy: { username: 'asc' }
  })

  console.log(`Total users: ${users.length}\n`)

  for (const user of users) {
    console.log(`${user.username} (${user.firstName} ${user.lastName}) - ID: ${user.id}`)

    // Check assigned locations
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: user.id },
      include: {
        location: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (userLocations.length > 0) {
      console.log('  Assigned locations:')
      userLocations.forEach(ul => {
        console.log(`    - ${ul.location.name} (ID: ${ul.location.id})`)
      })
    } else {
      console.log('  ⚠️  No locations assigned!')
    }
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
