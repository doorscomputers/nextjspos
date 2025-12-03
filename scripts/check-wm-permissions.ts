import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const menus = await prisma.roleMenuPermission.findMany({
    where: { roleId: 7 },
    include: { menuPermission: true }
  })

  console.log('Warehouse Manager (roleId=7) menu permissions:')
  menus.filter(m => m.menuPermission.key.includes('customer')).forEach(m => {
    console.log(' -', m.menuPermission.key)
  })

  // Check if user has CUSTOMER_VIEW in their role permissions
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: 7 },
    include: { permission: true }
  })

  console.log('\nRBAC permissions (customer related):')
  rolePerms.filter(p => p.permission.name.includes('customer')).forEach(p => {
    console.log(' -', p.permission.name)
  })

  await prisma.$disconnect()
}

check()
