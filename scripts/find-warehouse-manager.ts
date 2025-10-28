import { prisma } from '../src/lib/prisma'

async function findWarehouseManager() {
  try {
    // Find all users with warehouse manager role
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: 'Terre',
            },
          },
          {
            surname: {
              contains: 'Terre',
            },
          },
        ],
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    console.log('\n=== USERS WITH "TERRE" IN NAME ===')
    users.forEach((user) => {
      console.log(`\nUsername: ${user.username}`)
      console.log(`Name: ${user.firstName} ${user.surname}`)
      console.log(`Roles:`)
      user.roles.forEach((ur) => {
        console.log(`  - ${ur.role.name}`)
      })
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

findWarehouseManager()
