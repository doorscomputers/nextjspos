const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Updating Branch Manager role permissions...')

  // Find the Branch Manager role
  const branchManagerRole = await prisma.role.findFirst({
    where: { name: 'Branch Manager' }
  })

  if (!branchManagerRole) {
    console.log('❌ Branch Manager role not found')
    return
  }

  console.log(`✓ Found Branch Manager role (ID: ${branchManagerRole.id})`)

  // Find the inventory_correction.approve permission
  const approvePermission = await prisma.permission.findFirst({
    where: { name: 'inventory_correction.approve' }
  })

  if (!approvePermission) {
    console.log('❌ Approve permission not found')
    return
  }

  console.log(`✓ Found approve permission (ID: ${approvePermission.id})`)

  // Check if permission already exists
  const existing = await prisma.rolePermission.findUnique({
    where: {
      roleId_permissionId: {
        roleId: branchManagerRole.id,
        permissionId: approvePermission.id
      }
    }
  })

  if (existing) {
    console.log('✓ Permission already assigned to Branch Manager role')
    return
  }

  // Add the permission to the role
  await prisma.rolePermission.create({
    data: {
      roleId: branchManagerRole.id,
      permissionId: approvePermission.id
    }
  })

  console.log('✅ Successfully added inventory_correction.approve permission to Branch Manager role')
  console.log('ℹ️  Logout and login again for the changes to take effect')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
