import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPermissions() {
  const roleId = 7 // Warehouse Manager

  // Find CUSTOMER_VIEW and CUSTOMER_UPDATE permission IDs
  const customerView = await prisma.permission.findFirst({
    where: { name: 'customer.view' }
  })

  const customerUpdate = await prisma.permission.findFirst({
    where: { name: 'customer.update' }
  })

  console.log('Found permissions:')
  console.log('  customer.view ID:', customerView?.id)
  console.log('  customer.update ID:', customerUpdate?.id)

  if (!customerView || !customerUpdate) {
    console.log('ERROR: Required permissions not found in database')
    await prisma.$disconnect()
    return
  }

  // Add customer.view if not exists
  const existingView = await prisma.rolePermission.findFirst({
    where: { roleId, permissionId: customerView.id }
  })

  if (!existingView) {
    await prisma.rolePermission.create({
      data: { roleId, permissionId: customerView.id }
    })
    console.log('SUCCESS: Added customer.view to Warehouse Manager')
  } else {
    console.log('customer.view already exists')
  }

  // Add customer.update if not exists
  const existingUpdate = await prisma.rolePermission.findFirst({
    where: { roleId, permissionId: customerUpdate.id }
  })

  if (!existingUpdate) {
    await prisma.rolePermission.create({
      data: { roleId, permissionId: customerUpdate.id }
    })
    console.log('SUCCESS: Added customer.update to Warehouse Manager')
  } else {
    console.log('customer.update already exists')
  }

  console.log('\nDone! Please log out and log back in as Warehouse Manager.')

  await prisma.$disconnect()
}

addPermissions()
