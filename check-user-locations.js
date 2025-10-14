const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: { username: 'branchmanager' },
    select: {
      id: true,
      username: true,
      userLocations: {
        select: {
          locationId: true,
          location: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  })

  console.log('Branch Manager User:')
  console.log(JSON.stringify(user, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
