/**
 * Remove ACCESS_ALL_LOCATIONS permission from WarehouseManager role
 * Warehouse managers should only access their assigned branches
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Removing ACCESS_ALL_LOCATIONS from WarehouseManager role...\n')

  // Find the WarehouseManager role
  const role = await prisma.role.findFirst({
    where: {
      name: 'WarehouseManager'
    }
  })

  if (!role) {
    console.log('❌ WarehouseManager role not found')
    return
  }

  // Find the access_all_locations permission
  const permission = await prisma.permission.findFirst({
    where: {
      name: 'access_all_locations'
    }
  })

  if (!permission) {
    console.log('❌ access_all_locations permission not found')
    return
  }

  // Remove the permission from the role
  const deleted = await prisma.rolePermission.deleteMany({
    where: {
      roleId: role.id,
      permissionId: permission.id
    }
  })

  if (deleted.count > 0) {
    console.log('✅ Removed ACCESS_ALL_LOCATIONS permission from WarehouseManager role')
    console.log(`   (${deleted.count} record(s) deleted)`)
  } else {
    console.log('ℹ️  Permission was not assigned to this role')
  }

  console.log('\n💡 Warehouse managers now use branch assignments instead of global access')
  console.log('⚠️  Users must logout and login again for changes to take effect!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
