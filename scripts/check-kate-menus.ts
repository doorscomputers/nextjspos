import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkKateUsers() {
  const kateUsers = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'JASMIN', mode: 'insensitive' } },
        { firstName: { contains: 'KATE', mode: 'insensitive' } },
        { username: { contains: 'JASMIN', mode: 'insensitive' } }
      ]
    },
    include: {
      menuPermissions: {
        include: {
          menuPermission: true
        }
      },
      roles: {
        include: {
          role: {
            select: { id: true, name: true }
          }
        }
      }
    }
  })

  console.log('\n🔍 Checking JASMIN/KATE users for direct menu permissions:\n')

  kateUsers.forEach(user => {
    console.log(`User: ${user.username} (${user.firstName} ${user.lastName}) - ID: ${user.id}`)
    console.log(`Roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)

    if (user.menuPermissions.length > 0) {
      console.log(`⚠️  Direct Menu Permissions (${user.menuPermissions.length}):`)
      user.menuPermissions.forEach(mp => {
        console.log(`   - ${mp.menuPermission.name}`)
      })
    } else {
      console.log('✅ No direct menu permissions')
    }
    console.log('')
  })
}

checkKateUsers().finally(() => prisma.$disconnect())
