import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const user = await prisma.user.findFirst({
    where: { username: 'superadmin' },
    include: {
      roles: {
        include: {
          role: {
            select: { name: true }
          }
        }
      }
    }
  })

  if (!user) {
    console.log('❌ User "superadmin" not found')
  } else {
    console.log('✅ Found user: superadmin')
    console.log('   User ID:', user.id)
    console.log('   Roles:')
    user.roles.forEach(ur => {
      console.log(`   - ${ur.role.name}`)
    })
  }

  await prisma.$disconnect()
}

check()
