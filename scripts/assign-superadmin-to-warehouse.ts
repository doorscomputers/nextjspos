import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Assigning superadmin to Warehouse location...')
  
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
  
  // Assign superadmin to warehouse using UserLocation
  const existing = await prisma.userLocation.findFirst({
    where: {
      userId: superadmin.id,
      locationId: warehouse.id
    }
  })
  
  if (existing) {
    console.log(`✓ Superadmin already assigned to ${warehouse.name}`)
  } else {
    await prisma.userLocation.create({
      data: {
        userId: superadmin.id,
        locationId: warehouse.id
      }
    })
    console.log(`✓ Superadmin assigned to ${warehouse.name}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
