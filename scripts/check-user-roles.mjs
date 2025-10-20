import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n=== ALL USERS AND THEIR ROLES ===\n')

  const users = await prisma.user.findMany({
    include: {
      roles: true,
      business: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      username: 'asc'
    }
  })

  users.forEach(user => {
    console.log(`User: ${user.username} (${user.name})`)
    console.log(`  Business: ${user.business?.name || 'N/A'}`)
    console.log(`  Roles: ${user.roles.map(r => r.name).join(', ') || 'No roles assigned'}`)
    console.log(`  Active: ${user.isActive ? 'Yes' : 'No'}`)
    console.log('')
  })

  console.log(`Total users: ${users.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
