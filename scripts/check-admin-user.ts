import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking for admin user...')

  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' },
    select: {
      id: true,
      username: true,
      businessId: true,
      firstName: true,
      lastName: true,
    }
  })

  if (adminUser) {
    console.log('✅ Admin user found:')
    console.log(JSON.stringify(adminUser, null, 2))
  } else {
    console.log('❌ Admin user not found')
  }

  // Check all users
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      businessId: true,
    }
  })

  console.log(`\nTotal users in database: ${allUsers.length}`)
  if (allUsers.length > 0) {
    console.log('Users:', allUsers)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
