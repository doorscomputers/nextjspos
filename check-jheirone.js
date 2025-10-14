const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        contains: 'jheirone',
        mode: 'insensitive'
      }
    }
  })

  if (user) {
    console.log('Found user:')
    console.log('Username:', user.username)
    console.log('User ID:', user.id)
  } else {
    console.log('User not found, listing all users:')
    const users = await prisma.user.findMany({
      where: { businessId: 1 },
      select: { id: true, username: true, firstName: true }
    })
    users.forEach(u => console.log(`- ${u.username} (ID: ${u.id}) - ${u.firstName}`))
  }

  await prisma.$disconnect()
}

main().catch(console.error)
