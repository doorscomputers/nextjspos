import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkReturnPermissions() {
  const user = await prisma.user.findFirst({
    where: { username: 'superadmin' },
    include: {
      permissions: {
        include: { permission: true }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    console.log('User not found')
    return
  }

  const allPermissions = [
    ...user.permissions.map(up => up.permission.name),
    ...user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
  ]

  console.log('🔑 Purchase Return Permissions:\n')
  console.log('purchase_return.create:', allPermissions.includes('purchase_return.create') ? '✅ YES' : '❌ NO')
  console.log('purchase_return.approve:', allPermissions.includes('purchase_return.approve') ? '✅ YES' : '❌ NO')
  console.log('purchase_return.view:', allPermissions.includes('purchase_return.view') ? '✅ YES' : '❌ NO')

  await prisma.$disconnect()
}

checkReturnPermissions().catch(console.error)
