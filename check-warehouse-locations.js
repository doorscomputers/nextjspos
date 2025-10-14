const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== All Warehouse Locations ===\n')

  const locations = await prisma.businessLocation.findMany({
    where: {
      OR: [
        { name: { contains: 'warehouse', mode: 'insensitive' } },
        { name: { contains: 'Warehouse', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      name: true,
      businessId: true,
      deletedAt: true
    }
  })

  locations.forEach(loc => {
    console.log(`ID: ${loc.id} | Name: "${loc.name}" | Business: ${loc.businessId} | Deleted: ${loc.deletedAt ? 'YES' : 'NO'}`)
  })

  console.log('\n=== Jheirone\'s Assignment ===\n')

  const jheirone = await prisma.user.findFirst({
    where: { username: 'Jheirone' }
  })

  if (jheirone) {
    const assignments = await prisma.userLocation.findMany({
      where: { userId: jheirone.id },
      include: {
        location: true
      }
    })

    console.log(`User: Jheirone (ID: ${jheirone.id})`)
    console.log('Assigned to:')
    assignments.forEach(a => {
      console.log(`  - Location ID: ${a.locationId} | Name: "${a.location.name}"`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
