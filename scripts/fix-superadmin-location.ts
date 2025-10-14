import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Fixing superadmin location access for testing...')
  
  // Find superadmin user
  const superadmin = await prisma.user.findFirst({
    where: { username: 'superadmin' }
  })
  
  if (!superadmin) {
    console.error('Superadmin user not found')
    return
  }
  
  console.log(`Found superadmin: ${superadmin.username} (ID: ${superadmin.id})`)
  
  // Find Warehouse location
  const warehouse = await prisma.businessLocation.findFirst({
    where: {
      name: 'Warehouse',
      businessId: superadmin.businessId
    }
  })
  
  if (!warehouse) {
    console.error('Warehouse location not found')
    return
  }
  
  console.log(`Found warehouse: ${warehouse.name} (ID: ${warehouse.id})`)
  
  // Remove ACCESS_ALL_LOCATIONS permission from superadmin
  console.log('Removing ACCESS_ALL_LOCATIONS permission from superadmin...')
  await prisma.userPermission.deleteMany({
    where: {
      userId: superadmin.id,
      permission: 'access_all_locations'
    }
  })
  console.log('✓ ACCESS_ALL_LOCATIONS permission removed')
  
  // Remove all existing UserLocation assignments for superadmin
  await prisma.userLocation.deleteMany({
    where: { userId: superadmin.id }
  })
  console.log('✓ Cleared all location assignments')
  
  // Assign ONLY Warehouse to superadmin
  await prisma.userLocation.create({
    data: {
      userId: superadmin.id,
      locationId: warehouse.id
    }
  })
  console.log(`✓ Superadmin assigned ONLY to ${warehouse.name}`)
  console.log('\nSuperadmin now has access to a single location (Warehouse) for testing physical inventory.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
