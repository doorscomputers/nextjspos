import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find users with Warehouse Manager role using the correct relation name
  const users = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: 'Warehouse Manager' }
        }
      }
    },
    include: {
      roles: {
        include: { role: true }
      },
      permissions: {
        include: { permission: true }
      }
    }
  })

  console.log('Users with Warehouse Manager role:')
  for (const u of users) {
    console.log('\n  ID:', u.id, '- Username:', u.username)
    console.log('  Roles:', u.roles.map(r => r.role.name).join(', '))

    const customerPerms = u.permissions.filter(p => p.permission.name.includes('customer'))
    if (customerPerms.length > 0) {
      console.log('  Direct customer permissions:', customerPerms.map(p => p.permission.name).join(', '))
    } else {
      console.log('  No direct customer permissions (relies on role)')
    }
  }

  await prisma.$disconnect()
}

main()
