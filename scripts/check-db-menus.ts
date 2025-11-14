import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const allBranchAdmin = await prisma.role.findFirst({
    where: { name: 'All Branch Admin' },
    include: { menuPermissions: true }
  })

  const salesCashier = await prisma.role.findFirst({
    where: { name: 'Sales Cashier' },
    include: { menuPermissions: true }
  })

  console.log('📊 Database Menu Permissions Check:')
  console.log('=====================================')
  console.log(`All Branch Admin: ${allBranchAdmin?.menuPermissions.length || 0} menus`)
  console.log(`Sales Cashier: ${salesCashier?.menuPermissions.length || 0} menus`)

  await prisma.$disconnect()
}

check()
