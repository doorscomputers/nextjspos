const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Checking user jheirone...')

  const user = await prisma.user.findFirst({
    where: { username: 'jheirone' },
    select: {
      id: true,
      username: true,
      businessId: true,
    }
  })

  if (!user) {
    console.log('User jheirone not found!')
    return
  }

  console.log('User found:', user)

  console.log('\nChecking assigned locations...')
  const userLocations = await prisma.userLocation.findMany({
    where: { userId: user.id },
    include: {
      location: true
    }
  })

  console.log('Assigned locations count:', userLocations.length)
  console.log('Assigned locations:', JSON.stringify(userLocations, null, 2))

  console.log('\nAll business locations:')
  const allLocations = await prisma.businessLocation.findMany({
    where: { businessId: user.businessId },
    select: {
      id: true,
      name: true,
      deletedAt: true
    }
  })
  console.log(allLocations)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
