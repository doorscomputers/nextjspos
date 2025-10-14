/**
 * Assign warehouse managers to Warehouse location only
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Assigning warehouse managers to Warehouse location only...\n')

  // Find all locations
  const locations = await prisma.businessLocation.findMany()
  console.log('Available locations:')
  locations.forEach(loc => {
    console.log(`  ID: ${loc.id} - ${loc.name}`)
  })
  console.log('')

  // Find the Warehouse location
  const warehouse = locations.find(l => l.name === 'Warehouse')

  if (!warehouse) {
    console.error('❌ Warehouse location not found!')
    console.error('Available locations:', locations.map(l => l.name).join(', '))
    return
  }

  console.log(`✅ Found Warehouse location (ID: ${warehouse.id})\n`)

  // Find warehouse managers (users with WarehouseManager role)
  const warehouseManagers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: 'WarehouseManager'
          }
        }
      }
    }
  })

  console.log(`Found ${warehouseManagers.length} warehouse manager(s):\n`)
  warehouseManagers.forEach(user => {
    console.log(`  - ${user.username} (ID: ${user.id})`)
  })
  console.log('')

  // Clear existing assignments for these users
  await prisma.userLocation.deleteMany({
    where: {
      userId: { in: warehouseManagers.map(u => u.id) }
    }
  })

  // Assign each warehouse manager to Warehouse location only
  for (const user of warehouseManagers) {
    await prisma.userLocation.create({
      data: {
        userId: user.id,
        locationId: warehouse.id
      }
    })
    console.log(`✅ Assigned ${user.username} to Warehouse location`)
  }

  console.log('\n🎉 Done! Warehouse managers can now only access Warehouse branch.')
  console.log('💡 Users need to log out and log back in for changes to take effect!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
