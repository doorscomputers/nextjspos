import { prisma } from '../src/lib/prisma.simple.js'

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
      take: 30,
      orderBy: { id: 'asc' }
    })

    console.log('All users in database:\n')
    users.forEach(u => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(no name)'
      console.log(`  ${u.id}: ${u.username} - ${name}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

listUsers()
