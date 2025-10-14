const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      businessId: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  console.log('Users in database:')
  users.forEach(u => {
    console.log(`  - ${u.username} (ID: ${u.id}, Business: ${u.businessId})`)
    u.roles.forEach(r => console.log(`    Role: ${r.role.name}`))
  })

  await prisma.$disconnect()
}

checkUsers()
