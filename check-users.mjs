import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      businessId: true,
      email: true,
    },
  })

  console.log('Users in database:')
  console.log(JSON.stringify(users, null, 2))

  await prisma.$disconnect()
}

main().catch(console.error)
